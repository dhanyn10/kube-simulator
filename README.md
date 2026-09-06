# 🚀 Kube Simulator

Kube Simulator is a powerful, interactive visual designer for Kubernetes infrastructure. Built with **Wails**, **Go**, and **React**, it allows developers and DevOps engineers to architect complex Kubernetes environments with a drag-and-drop interface and instantly generate valid manifests.

---

## ✨ Features

- **Visual Infrastructure Design**: Drag and drop Kubernetes resources onto a canvas to design your cluster architecture.
- **Smart Resource Configuration**: Detailed configuration panels for:
  - **Workloads**: Deployments, StatefulSets, and DaemonSets.
  - **Networking**: Services, Ingress, and Internet connectivity.
  - **Storage**: Persistent Volume Claims (PVCs) and Data Resources (ConfigMaps/Secrets).
  - **Scaling**: Horizontal Pod Autoscalers (HPA).
- **Auto-Validation**: Real-time validation of names and configurations following Kubernetes DNS-1123 standards.
- **YAML Generation**: One-click generation of production-ready Kubernetes YAML manifests.
- **Simulation Engine**: Preview how traffic flows through your services and workloads.
- **Integrated Logging**: Real-time backend and frontend log monitoring with Gmail-style management.

## 🛠️ Tech Stack

- **Backend**: Go with [Wails v2](https://wails.io/)
- **Frontend**: React, TypeScript, Tailwind CSS, Zustand
- **Canvas Engine**: [React Flow](https://reactflow.dev/)
- **Build System**: pnpm

## 📦 Installation

### Windows
1. Go to the [Releases](https://github.com/dhanyn10/kube-simulator/releases) page.
2. Download the `kube-simulator-installer.exe` for a standard installation or `kube-simulator-portable.exe` for a zero-install experience.
3. Run the application.

## 🚀 Getting Started

1. **Add Nodes**: Use the sidebar to drag resources (Pod, Service, Ingress, etc.) onto the canvas.
2. **Connect Resources**: Click and drag from one resource handle to another to define relationships.
3. **Configure**: Click on a node to open the **Right Sidebar** and customize its properties (images, replicas, ports, etc.).
4. **Simulate**: Click the **Play** button in the top menu bar to start the simulation and see connectivity in action.
5. **Export**: Once satisfied, use the **Export YAML** button to get your Kubernetes manifest.

## 🔨 Development

### Prerequisites
- [Go](https://go.dev/) 1.25+
- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/dhanyn10/kube-simulator.git
   cd kube-simulator
   ```

2. Install dependencies:
   ```bash
   # Root directory
   go mod download

   # Frontend directory
   cd frontend
   pnpm install
   ```

3. Run in development mode:
   ```bash
   wails dev
   ```

4. Build for production:
   ```bash
   # Using the provided script
   ./build-dist.sh
   ```

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Built with ❤️ by [Dhany Nurdiansyah (dhanyn10)](https://github.com/dhanyn10)
