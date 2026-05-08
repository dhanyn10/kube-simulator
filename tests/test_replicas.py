import pytest
from playwright.sync_api import Page, expect
import os

BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:3000")

def test_standalone_pod_replica_change(page: Page):
    page.goto(BASE_URL)

    # Add a Pod
    page.get_by_role("button", name="Pod Atomic unit of K8s").click()

    # Find the pod node
    pod = page.locator(".react-flow__node-Pod").first
    pod.click(force=True)

    # Click gear button
    pod.locator("button:has(svg.lucide-settings)").click(force=True)

    # Check initial replica value
    replica_input = page.locator("input[type='number']").first
    expect(replica_input).to_have_value("1")

    # Click Plus button
    page.locator("button:has(svg.lucide-plus)").first.click()

    # Check if value increased
    expect(replica_input).to_have_value("2")

    # Check badge on node
    expect(page.locator(".react-flow__node-Pod:has-text('x2')")).to_be_visible()

def test_deployment_pod_replica_change(page: Page):
    page.goto(BASE_URL)

    # Add a Deployment
    page.get_by_role("button", name="Deployment Pod controller").click()

    # Select Deployment and open settings
    page.get_by_text("DEPLOYMENT", exact=True).click(force=True)
    page.locator(".react-flow__node-Deployment button:has(svg.lucide-settings)").click(force=True)

    replica_input = page.locator("input[type='number']").first

    # Increase replicas to 1
    page.locator("button:has(svg.lucide-plus)").first.click()
    expect(replica_input).to_have_value("1")

    # Now a Pod should appear inside the Deployment
    pod_in_dep = page.locator(".react-flow__node-Pod").first
    expect(pod_in_dep).to_be_visible()

    # Select the Pod inside the deployment
    pod_in_dep.click(force=True)
    pod_in_dep.locator("button:has(svg.lucide-settings)").click(force=True)

    # Try to change replica from the Pod's config panel
    page.locator("button:has(svg.lucide-plus)").first.click()

    # It should update to 2
    expect(replica_input).to_have_value("2")
