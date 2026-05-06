import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:3000')
        await page.wait_for_selector('text=InfraStack Architect')

        # Check initial state (should be closed)
        # Using a marker like 'Pod' which is in 'Workloads'
        pod_visible = await page.is_visible('text=Atomic unit of K8s')
        print(f"Pod visible on start: {pod_visible}")

        # Click Workloads
        await page.click('text=Workloads')
        await asyncio.sleep(0.5)
        pod_visible = await page.is_visible('text=Atomic unit of K8s')
        print(f"Pod visible after clicking Workloads: {pod_visible}")

        # Click Networking
        await page.click('text=Networking')
        await asyncio.sleep(0.5)
        pod_visible = await page.is_visible('text=Atomic unit of K8s')
        print(f"Pod visible after clicking Networking (should be hidden): {pod_visible}")

        service_visible = await page.is_visible('text=Network endpoint')
        print(f"Service visible after clicking Networking: {service_visible}")

        await page.screenshot(path='/home/jules/verification/accordion_networking_open.png')
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
