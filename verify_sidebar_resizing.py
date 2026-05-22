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

        # Add a node to select it
        await page.evaluate("""() => {
            const store = globalThis.useFlowStore.getState();
            store.addNode('Pod');
            // Force a small delay to ensure node is in state
            setTimeout(() => {
                const podId = globalThis.useFlowStore.getState().nodes[0].id;
                globalThis.useFlowStore.getState().setConfiguringNodeId(podId);
            }, 100);
        }""")

        await asyncio.sleep(0.5)

        # Wait for Config Panel to appear
        await page.wait_for_selector('text=Pod Config')

        # Take screenshot of the sidebar
        await page.screenshot(path='/home/jules/verification/sidebar_resizing.png')

        # Check Canvas dropdown
        await page.click('button:has-text("Canvas")')
        await asyncio.sleep(0.2)
        await page.screenshot(path='/home/jules/verification/sidebar_canvas_dropdown.png')

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
