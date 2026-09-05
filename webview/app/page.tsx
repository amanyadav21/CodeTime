import { Dashboard } from '../components/Dashboard';

export default function Page() {
  // V1 webview is a single page; VS Code mounts us inside a WebviewView.
  return <Dashboard />;
}
