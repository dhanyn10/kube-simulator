import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Go to the app
        await page.goto('http://localhost:3001')
        await page.wait_for_selector('text=Kube Simulator')

        # Ensure no node is selected
        await page.evaluate("""() => {
            const store = globalThis.useFlowStore.getState();
            store.setConfiguringNodeId(null);
            store.setConfiguringEdgeId(null);
        }""")

        await asyncio.sleep(0.5)

        # Take screenshot of the sidebar (should only show widgets if any are on by default)
        await page.screenshot(path='/home/jules/verification/sidebar_blank.png')

        # Toggle all widgets OFF
        await page.evaluate("""() => {
            const store = globalThis.useFlowStore.getState();
            store.visibleWidgets.forEach(w => store.toggleWidget(w));
        }""")

        await asyncio.sleep(0.5)
        await page.screenshot(path='/home/jules/verification/sidebar_fully_blank.png')

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
