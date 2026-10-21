import { expect, test } from './fixtures';

/** The web app manifest: what lets a phone or a desktop browser install the app with its own name and icon. */
test.describe('Web app manifest', () => {
  test('is linked from every page, and says what the installed app is called, where it starts and how it opens', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href, 'the page links its manifest').toBe('manifest.webmanifest');

    const response = await request.get('/manifest.webmanifest');
    await expect(response, 'the manifest is served').toBeOK();
    expect(response.headers()['content-type'], 'as a manifest, not a page').toContain('manifest+json');
    const manifest = await response.json();

    expect(manifest.name, 'the full name').toBe('Mortgage Analytics');
    expect(manifest.start_url, 'opens on the start page').toBe('/');
    expect(manifest.display, 'in its own window, without the browser around it').toBe('standalone');
    expect(manifest.shortcuts.map((s: { url: string }) => s.url), 'a long press offers the three questions').toEqual(['/calculator', '/refinance', '/strategy']);
  });

  test('has the icons an install needs, each a real picture of the size it claims', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    const sizes = new Set<string>();
    expect(manifest.icons.map((i: { purpose: string }) => i.purpose), 'one for any use and one that survives a mask').toEqual(['any', 'any', 'maskable']);

    for (const icon of manifest.icons as { src: string; sizes: string; type: string }[]) {
      const image = await request.get(`/${icon.src}`);
      await expect(image, `${icon.src} is served`).toBeOK();
      expect(image.headers()['content-type'], `${icon.src} is a PNG`).toBe('image/png');
      const bytes = await image.body();
      // A PNG's width and height are the two 32-bit numbers after its 16-byte signature and header.
      const size = `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
      expect(size, `${icon.src} is the size the manifest says`).toBe(icon.sizes);
      sizes.add(size);
    }
    expect([...sizes].sort(), 'the two sizes browsers ask for').toEqual(['192x192', '512x512']);
  });
});
