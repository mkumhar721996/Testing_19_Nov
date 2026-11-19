import multipart from '@fastify/multipart';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { requireRole } from '../auth/actor.js';
import { NotFoundError, NothingPendingError } from '../profiles/store.js';
import type { Actor, DocType, ProfileStore, StoredFile } from '../profiles/types.js';

const MB = 1024 * 1024;
const MAX_NAME = 80;
const MAX_BIO = 300;
const PHOTO_TYPES = ['image/jpeg', 'image/png'];
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const DOC_KINDS: DocType[] = ['licence', 'insurance'];

type Parsed = { fields: Record<string, string>; file?: StoredFile; error?: string };

async function parseUpload(
  request: FastifyRequest,
  fileField: string,
  allowed: string[],
  allowedLabel: string,
  maxBytes: number,
): Promise<Parsed> {
  const fields: Record<string, string> = {};
  let file: StoredFile | undefined;
  let error: string | undefined;
  for await (const part of request.parts({ limits: { fileSize: maxBytes } })) {
    if (part.type === 'field') {
      fields[part.fieldname] = String(part.value);
      continue;
    }
    const data = await part.toBuffer();
    if (part.fieldname !== fileField || (!data.length && !part.filename)) continue;
    if (!allowed.includes(part.mimetype)) {
      error = `${part.filename} is not a supported file. Upload a ${allowedLabel} file.`;
    } else if (part.file.truncated) {
      error = `${part.filename} is too large. Upload a file of ${maxBytes / MB} MB or less.`;
    } else {
      file = { fileName: part.filename, contentType: part.mimetype, size: data.length, data };
    }
  }
  return { fields, file, error };
}

/** No document approval step exists yet, so every document is awaiting review. */
const docMeta = (type: string, d: StoredFile & { uploadedAt: string }) => ({
  type,
  fileName: d.fileName,
  contentType: d.contentType,
  size: d.size,
  uploadedAt: d.uploadedAt,
  status: 'awaiting-review' as const,
});

const sendFile = (reply: FastifyReply, f: StoredFile | undefined) =>
  f ? reply.type(f.contentType).send(f.data) : reply.code(404).send({ message: 'File not found.' });

export const profileRoutes: FastifyPluginAsync<{ store: ProfileStore }> = async (app, { store }) => {
  await app.register(multipart);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof NotFoundError) return reply.code(404).send({ message: err.message });
    if (err instanceof NothingPendingError) return reply.code(409).send({ message: err.message });
    return reply.send(err);
  });

  const provider = { preHandler: requireRole('provider') };
  const admin = { preHandler: requireRole('admin') };

  // Customer surface: built only from approved fields, never documents or pending data.
  app.get<{ Params: { id: string } }>('/providers/:id', async (req, reply) => {
    const p = store.getProfile(req.params.id);
    if (!p) return reply.code(404).send({ message: 'Provider not found.' });
    return {
      id: p.id,
      displayName: p.displayName,
      ...(p.approvedPhoto ? { photoUrl: `/providers/${p.id}/photo` } : {}),
      ...(p.approvedBio ? { bio: p.approvedBio } : {}),
    };
  });

  app.get<{ Params: { id: string } }>('/providers/:id/photo', async (req, reply) =>
    sendFile(reply, store.getProfile(req.params.id)?.approvedPhoto),
  );

  // Provider surface
  app.get('/me/profile', provider, async (req) => {
    const p = store.getProfile((req.actor as Actor).id);
    if (!p) throw new NotFoundError('Provider not found.');
    return {
      id: p.id,
      displayName: p.displayName,
      bio: p.approvedBio,
      hasPhoto: Boolean(p.approvedPhoto),
      photoUrl: p.approvedPhoto && `/providers/${p.id}/photo`,
      pending: p.pending && {
        bio: p.pending.bio,
        hasPhoto: Boolean(p.pending.photo),
        submittedAt: p.pending.submittedAt,
      },
      documents: Object.entries(p.documents).map(([t, d]) => docMeta(t, d!)),
    };
  });

  app.put<{ Body: { displayName?: unknown } }>('/me/profile/display-name', provider, async (req, reply) => {
    const name = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!name || name.length > MAX_NAME) {
      return reply.code(400).send({ message: `Enter a display name of 1 to ${MAX_NAME} characters.` });
    }
    store.setDisplayName((req.actor as Actor).id, name, req.actor as Actor);
    return { displayName: name };
  });

  app.post('/me/profile/submissions', provider, async (req, reply) => {
    const { fields, file, error } = await parseUpload(req, 'photo', PHOTO_TYPES, 'JPG or PNG', 5 * MB);
    if (error) return reply.code(400).send({ message: error });
    const bio = fields.bio?.trim();
    if (bio && bio.length > MAX_BIO) {
      return reply.code(400).send({ message: `Enter a bio of ${MAX_BIO} characters or fewer.` });
    }
    if (!bio && !file) return reply.code(400).send({ message: 'Add a photo or a bio to submit.' });
    store.submitChange((req.actor as Actor).id, { bio: bio || undefined, photo: file }, req.actor as Actor);
    return reply.code(202).send({ status: 'awaiting-review' });
  });

  app.post('/me/documents', provider, async (req, reply) => {
    const { fields, file, error } = await parseUpload(req, 'file', DOC_TYPES, 'PDF, JPG or PNG', 10 * MB);
    if (error) return reply.code(400).send({ message: error });
    if (!DOC_KINDS.includes(fields.type as DocType)) {
      return reply.code(400).send({ message: 'Choose a document type: licence or insurance.' });
    }
    if (!file) return reply.code(400).send({ message: 'Choose a file to upload (PDF, JPG or PNG).' });
    store.putDocument((req.actor as Actor).id, fields.type as DocType, file, req.actor as Actor);
    return reply.code(201).send({ type: fields.type, fileName: file.fileName });
  });

  // Admin surface
  app.get<{ Params: { id: string } }>('/admin/providers/:id/review', admin, async (req) => {
    const p = store.getProfile(req.params.id);
    if (!p) throw new NotFoundError('Provider not found.');
    return {
      id: p.id,
      displayName: p.displayName,
      live: { bio: p.approvedBio, hasPhoto: Boolean(p.approvedPhoto), photoUrl: p.approvedPhoto && `/providers/${p.id}/photo` },
      pending: p.pending && {
        bio: p.pending.bio,
        hasPhoto: Boolean(p.pending.photo),
        submittedAt: p.pending.submittedAt,
      },
      documents: Object.entries(p.documents).map(([t, d]) => docMeta(t, d!)),
    };
  });

  app.get<{ Params: { id: string; type: string } }>('/admin/providers/:id/documents/:type', admin, async (req, reply) =>
    sendFile(reply, store.getProfile(req.params.id)?.documents[req.params.type as DocType]),
  );

  app.get<{ Params: { id: string } }>('/admin/providers/:id/submission/photo', admin, async (req, reply) =>
    sendFile(reply, store.getProfile(req.params.id)?.pending?.photo),
  );

  for (const decision of ['approve', 'reject'] as const) {
    app.post<{ Params: { id: string } }>(`/admin/providers/:id/submission/${decision}`, admin, async (req) => {
      store.resolvePending(req.params.id, decision, req.actor as Actor);
      return { status: decision === 'approve' ? 'approved' : 'rejected' };
    });
  }
};
