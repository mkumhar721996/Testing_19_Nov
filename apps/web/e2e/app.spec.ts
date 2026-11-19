import { test, expect } from '@playwright/test'

test('home page shows the sign-in page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('shows the role label after sign-in', async ({ page }) => {
  await page.route('**/auth/sign-in', (route) =>
    route.fulfill({
      json: {
        token: 't',
        user: {
          id: 'u1',
          displayName: 'Sam OrgStaff',
          email: 'org.staff@example.test',
          role: 'org_staff',
          roleLabel: 'Org Staff',
          organization: null,
        },
      },
    }),
  )
  await page.goto('/')
  await page.getByLabel('Email').fill('org.staff@example.test')
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Org Staff')).toBeVisible()
})
