import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: change "departures" below to match your GitHub repo name.
// If your repo is github.com/yourname/departures, base stays "/departures/".
// If your repo is github.com/yourname/my-cool-app, base becomes "/my-cool-app/".
export default defineConfig({
  plugins: [react()],
  base: "/departures/",
});
