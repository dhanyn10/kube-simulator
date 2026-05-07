import pytest
from playwright.sync_api import Page, expect

BASE_URL = "http://localhost:3000"

def test_sidebar_sections_toggle(page: Page):
    page.goto(BASE_URL)

    # Workloads is expanded by default according to Sidebar.tsx
    workloads_section = page.get_by_role("button", name="Workloads")
    expect(page.get_by_text("Deployment", exact=True)).to_be_visible()

    # Toggle Networking
    networking_button = page.get_by_role("button", name="Networking")
    networking_button.click()

    # Networking items should be visible
    expect(page.get_by_text("Service", exact=True)).to_be_visible()

    # Workloads items should be hidden (since only one section expands at a time)
    expect(page.get_by_text("Deployment", exact=True)).not_to_be_visible()

def test_add_nodes_from_sidebar(page: Page):
    page.goto(BASE_URL)

    # Add a Pod (it's in Workloads which is open by default)
    page.get_by_role("button", name="Pod Atomic unit of K8s").click()

    # Verify node appears on canvas
    # React Flow nodes usually have the 'react-flow__node' class
    # And we can check for the label text "Pod" inside it
    expect(page.locator(".react-flow__node:has-text('pod')")).to_be_visible()

    # Add a Service (need to open Networking section)
    page.get_by_role("button", name="Networking").click()
    page.get_by_role("button", name="Service Network endpoint").click()

    # Verify node appears on canvas
    expect(page.locator(".react-flow__node:has-text('service')")).to_be_visible()

def test_sidebar_search(page: Page):
    page.goto(BASE_URL)

    search_input = page.get_by_placeholder("Search...")
    search_input.fill("Deployment")

    expect(page.get_by_text("Deployment", exact=True)).to_be_visible()
    expect(page.get_by_text("Pod", exact=True)).not_to_be_visible()

    search_input.fill("nonexistent")
    expect(page.get_by_text("No elements found")).to_be_visible()
