import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})

        print("Connecting to app...")
        await page.goto('http://localhost:3000')
        await page.wait_for_selector('.react-flow')

        # Add Deployment at some offset
        print("Adding Deployment...")
        await page.click('text=Deployment')
        await page.wait_for_timeout(1000)

        # Add Pod to Deployment
        print("Adding Pod to Deployment...")
        # Clicking center of deployment (assuming it's around 100, 100 initially)
        await page.click('.react-flow__node-deployment')
        await page.click('text=Pod')
        await page.wait_for_timeout(1000)

        # Move Deployment to a clearly non-origin position
        # We'll drag it
        print("Dragging Deployment...")
        # Get position
        box = await page.locator('.react-flow__node-deployment').bounding_box()
        if box:
            await page.mouse.move(box['x'] + 50, box['y'] + 10)
            await page.mouse.down()
            await page.mouse.move(box['x'] + 500, box['y'] + 400)
            await page.mouse.up()

        await page.wait_for_timeout(1000)

        # Take screenshot of the whole page to see canvas and minimap
        await page.screenshot(path='/home/jules/verification/minimap_issue.png')

        # Specifically zoom in on the minimap
        minimap_box = await page.locator('.react-flow__minimap').bounding_box()
        if minimap_box:
            await page.screenshot(path='/home/jules/verification/minimap_only.png', clip=minimap_box)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
