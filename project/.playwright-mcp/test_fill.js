async (page) => {
  await page.evaluate(() => {
    const form = document.querySelector('[x-data]');
    if (!form || !form.__x) return;
    const d = form.__x.$data;
    d.fullName = 'Test User';
    d.email = 'testuser@test.com';
    d.password = 'test123456';
    d.confirmPassword = 'test123456';
    const pwd = document.querySelector('input[placeholder="Password"]');
    if (pwd) { pwd.value = 'test123456'; pwd.dispatchEvent(new Event('input', { bubbles: true })); }
    const cfm = document.querySelector('input[placeholder="Confirm Password"]');
    if (cfm) { cfm.value = 'test123456'; cfm.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  return 'done';
}
