// stackbit.config.ts
import { defineStackbitConfig } from "@stackbit/types";

export default defineStackbitConfig({
  // ...
  modelExtensions: [
    // Extend the "Page" and "Post" models by defining them as page models
    { name: "Page", type: "page" },
    { name: "Post", type: "page" }
  ]
});
