import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders login screen when unauthenticated", () => {
  render(<App />);

  // Since ProtectedRoute guards the app, unauthenticated users should land on Login.
  expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
  expect(screen.getByText(/sign in to access/i)).toBeInTheDocument();
});
