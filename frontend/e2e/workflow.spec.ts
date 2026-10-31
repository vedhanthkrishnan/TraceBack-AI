import { expect, test, type Page } from '@playwright/test'

/**
 * End-to-end workflow tests. They run against the REAL backend (seeded with `backend/scripts/seed_demo.py`) so they verify
 * the live API contract. Machine IDs are read from the UI rather than hardcoded wherever possible.
 */

const consoleErrors = (page: Page) => {
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()))
  return errs
}

test('fleet → critical filter → machine → evidence → match → copilot → citation → back', async ({ page }) => {
  const errs = consoleErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Fleet Overview' })).toBeVisible()

  // 1. summary visible and consistent with the table
  const total = Number(await page.locator('button[aria-pressed]', { hasText: 'Machines analysed' }).locator('div.tabular').innerText())
  expect(total).toBeGreaterThan(0)

  // 2. filter to Critical via the metric card
  await page.locator('button', { hasText: /^Critical/ }).first().click()
  await expect(page).toHaveURL(/risk=CRITICAL/)
  const rows = page.locator('tbody tr')
  // the table keeps previous rows while refetching, so wait until only Critical rows remain
  await expect(page.locator('tbody [data-risk]:not([data-risk=CRITICAL])')).toHaveCount(0)
  await expect(rows.first().locator('[data-risk=CRITICAL]')).toBeVisible()

  // 3. open a machine
  const id = (await rows.first().locator('th').innerText()).trim()
  await rows.first().click()
  await expect(page).toHaveURL(new RegExp(`/machines/${id}`))
  await expect(page.getByRole('heading', { name: `Machine ${id}` })).toBeVisible()

  // 4. health history chart renders with a text alternative
  await expect(page.getByRole('img', { name: /Health score by cycle/ })).toBeVisible()

  // 5. select a sensor → its evidence expands
  const firstSensor = page.locator('#evidence tbody tr th button').first()
  const sensor = (await firstSensor.innerText()).trim()
  await firstSensor.click()
  await expect(page).toHaveURL(new RegExp(`sensor=${sensor}`))
  await expect(page.getByRole('button', { name: `Ask Copilot why ${sensor} matters` })).toBeVisible()

  // 6. open a historical match comparison
  await page.locator('#matches').getByRole('button', { name: 'Compare' }).first().click()
  await expect(page.getByText('Shared abnormal sensors:').nth(1)).toBeVisible()

  // 7. ask the Copilot why the machine is critical
  await page.getByRole('button', { name: new RegExp(`Why is ${id}`) }).click()
  await expect(page.getByTestId('evidence-citation').first()).toBeVisible({ timeout: 20_000 })

  // 8. follow an evidence reference (sensor citation) back to the sensor evidence
  const cite = page.locator('[data-testid=evidence-citation]', { hasText: /View s\d+ evidence/ }).first()
  await cite.click()
  await expect(page).toHaveURL(/sensor=s\d+/)
  await expect(page.locator('#evidence')).toBeVisible()

  // 9. back to the fleet
  await page.getByRole('link', { name: 'Fleet', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Fleet Overview' })).toBeVisible()
  expect(errs, errs.join('\n')).toEqual([])
})

test('"Ask Copilot why <sensor> matters" sends a question for that sensor', async ({ page }) => {
  await page.goto('/machines/M010')
  const first = page.locator('#evidence tbody tr th button').first()
  const sensor = (await first.innerText()).trim()
  await first.click()
  await page.getByRole('button', { name: `Ask Copilot why ${sensor} matters` }).click()
  await expect(page.getByRole('log').getByText(new RegExp(`Why does sensor ${sensor} matter`))).toBeVisible()
  await expect(page.getByTestId('evidence-citation').first()).toBeVisible({ timeout: 20_000 })
})

test('benchmarks page shows measured results or an honest empty state', async ({ page }) => {
  await page.goto('/benchmarks')
  await expect(page.getByRole('heading', { name: 'Benchmarks' })).toBeVisible()
  await expect(page.getByText(/No benchmarks have been recorded|Measurements/)).toBeVisible()
})

test('unknown machine shows a not-found state, unknown route shows 404 page', async ({ page }) => {
  await page.goto('/machines/NOT-A-MACHINE')
  await expect(page.getByText(/was not found/)).toBeVisible()
  await page.goto('/definitely/not/a/page')
  await expect(page.getByText('Page not found')).toBeVisible()
})

test('nested routes survive a hard refresh and back/forward navigation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Failure Patterns' }).click()
  await expect(page.getByRole('heading', { name: 'Failure Patterns' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Failure Patterns' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Fleet Overview' })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Failure Patterns' })).toBeVisible()
})

test('backend unavailable: visible errors with retry, app does not crash, no fake green status', async ({ page }) => {
  await page.route('**/api/v1/**', (r) => r.abort('connectionrefused'))
  await page.goto('/')
  await expect(page.getByRole('alert').first()).toBeVisible()
  await expect(page.getByText('API offline')).toBeVisible()
  await expect(page.getByText('API connected')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible()
  await page.getByRole('link', { name: 'AI Copilot' }).click()
  await expect(page.getByRole('heading', { name: 'TraceBack Copilot' }).first()).toBeVisible()
})

test('copilot failure shows an error and never invents an answer', async ({ page }) => {
  await page.route('**/api/v1/copilot/chat', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'ProviderUnavailable', message: 'LLM provider unavailable.', request_id: 'x' }) }))
  await page.goto('/copilot')
  await page.getByLabel('Ask the Copilot a question').fill('Why is anything critical?')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert').filter({ hasText: /Backend error|unavailable/i })).toBeVisible()
  await expect(page.getByTestId('evidence-citation')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
})

test('responsive: mobile drawer navigation works and the page does not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Fleet Overview' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Benchmarks' }).click()
  await expect(page.getByRole('heading', { name: 'Benchmarks' })).toBeVisible()
})

test('keyboard: fleet table sort header is operable and search jumps to a machine', async ({ page }) => {
  await page.goto('/')
  const sort = page.locator('th button', { hasText: 'Machine' }).first()
  await sort.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/sort=machine_id/)
  const search = page.getByRole('combobox', { name: 'Search machines by ID' })
  await search.fill('M01')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/machines\/M01/)
})
