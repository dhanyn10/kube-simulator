import pytest
import os
import time
from playwright.sync_api import Page, expect

BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:3000")

def test_pod_config_panel(page: Page):
    page.goto(BASE_URL)

    # Add a Pod
    page.get_by_role("button", name="Pod Atomic unit of K8s").click()

    # Find the node and click the settings button
    pod_node = page.locator(".react-flow__node-Pod").first
    pod_node.hover()

    # The settings button has the lucide-settings icon
    settings_button = pod_node.locator("button").filter(has=page.locator("svg.lucide-settings"))
    settings_button.click()

    # Verify Config Panel title and specific fields
    expect(page.get_by_text("POD CONFIGURATION")).to_be_visible()
    expect(page.get_by_text("Web Server")).to_be_visible()
    expect(page.get_by_text("App Runtime")).to_be_visible()

def test_service_config_panel(page: Page):
    page.goto(BASE_URL)

    # Open Networking and add a Service
    page.get_by_role("button", name="Networking").click()
    page.get_by_role("button", name="Service Network endpoint").click()

    # Find the node and click settings
    service_node = page.locator(".react-flow__node-Service").first
    service_node.hover()
    settings_button = service_node.locator("button").filter(has=page.locator("svg.lucide-settings"))
    settings_button.click()

    # Verify Config Panel title and specific fields
    expect(page.get_by_text("SERVICE CONFIGURATION")).to_be_visible()
    expect(page.get_by_text("Port", exact=True)).to_be_visible()
    expect(page.get_by_text("Target Port")).to_be_visible()
    expect(page.get_by_text("Selector (app)")).to_be_visible()

def test_ingress_config_panel(page: Page):
    page.goto(BASE_URL)

    # Open Networking and add an Ingress
    page.get_by_role("button", name="Networking").click()
    page.get_by_role("button", name="Ingress External Access").click()

    # Find the node and click settings
    ingress_node = page.locator(".react-flow__node-Ingress").first
    ingress_node.hover()
    settings_button = ingress_node.locator("button").filter(has=page.locator("svg.lucide-settings"))
    settings_button.click()

    # Verify Config Panel title and specific fields
    expect(page.get_by_text("INGRESS CONFIGURATION")).to_be_visible()
    # Use a more specific locator for Config Panel labels
    config_panel = page.locator(".fixed.right-4")
    expect(config_panel.get_by_text("Host", exact=True)).to_be_visible()
    expect(config_panel.get_by_text("Path", exact=True)).to_be_visible()

def test_yaml_inspector(page: Page):
    page.goto(BASE_URL)

    # Add a Pod to have some YAML content
    page.get_by_role("button", name="Pod Atomic unit of K8s").click()

    # Click Inspector button
    page.get_by_role("button", name="Inspector").click()

    # Verify YAML modal appears
    expect(page.get_by_text("Kubernetes Manifest Output")).to_be_visible()
    # Check if it contains 'kind: Pod'
    expect(page.locator("pre")).to_contain_text("kind: Pod")
