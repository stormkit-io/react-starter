import type { RenderFunction } from "./entry-server";
import fs from "fs";
import path from "path";
import express from "express";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import apiMiddleware from "@stormkit/serverless/middlewares/express";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function injectContent(head: string, content: string, template: string) {
  return template
    .replace(`</head>`, `${head}</head>`)
    .replace(`<div id="root"></div>`, `<div id="root">${content}</div>`);
}

async function createServer() {
  const app = express();

  // Create Vite server in middleware mode and configure the app type as
  // 'custom', disabling Vite's own HTML serving logic so parent server
  // can take control
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  // use vite's connect instance as middleware
  // if you use your own express router (express.Router()), you should use router.use
  app.use(vite.middlewares);

  // Add support for a local environment API.
  app.all(
    ["/api", "/api/*splat"],
    apiMiddleware({
      apiDir: "src/api",
      moduleLoader: vite.ssrLoadModule,
    })
  );

  app.get("*splat", async (req, res, next) => {
    try {
      const url: string = req.originalUrl.split(/\?#/)[0] || "/";

      // // 1. Read and apply Vite HTML transforms. This injects the Vite HMR client, and
      // //    also applies HTML transforms from Vite plugins, e.g. global preambles
      // //    from @vitejs/plugin-react
      const template: string = await vite.transformIndexHtml(
        req.originalUrl,
        fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf-8")
      );

      // 2. Load the server entry. vite.ssrLoadModule automatically transforms
      //    your ESM source code to be usable in Node.js! There is no bundling
      //    required, and provides efficient invalidation similar to HMR.
      const { render } = (await vite.ssrLoadModule("./src/entry-server")) as {
        render: RenderFunction;
      };

      const rendered = await render(url);

      res
        .status(rendered.status)
        .set({ "Content-Type": "text/html" })
        .send(injectContent(rendered.head, rendered.content, template));
    } catch (e) {
      // If an error is caught, let Vite fix the stack trace so it maps back to
      // your actual source code.
      if (e instanceof Error) {
        vite.ssrFixStacktrace(e);
      }

      next(e);
    }
  });

  const port = process.env.PORT || 5173;

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

async function generateStaticPages() {
  // Create Vite server to load the routes files
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
  });

  const { default: routesToPrerender } = (await vite.ssrLoadModule(
    "./src/prerender"
  )) as { default: string[] };

  const { render } = await vite.ssrLoadModule("./src/entry-server");

  const dist = path.join(path.dirname(__dirname), ".stormkit/public");

  if (!fs.existsSync(dist)) {
    throw new Error(
      ".stormkit/public is not available. Did you run `npm run build:spa`?"
    );
  }

  const template = fs.readFileSync(path.join(dist, "index.html"), "utf-8");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dist, ".vite", "manifest.json"), "utf-8")
  );

  // Push `/` to the end if any.
  routesToPrerender.sort((a: string, b: string) => {
    return a === "/" || b === "/" ? -1 : 0;
  });

  for (const r of routesToPrerender) {
    const data = await render(r);
    const fileName = r.endsWith("/") ? `${r}index.html` : `${r}.html`;
    const absPath = path.join(dist, fileName);
    let content = injectContent(data.head, data.content, template);

    // Fix the path to the static assets.
    Object.keys(manifest).forEach((fileName) => {
      if (fileName.startsWith("src/assets")) {
        content = content.replace(
          new RegExp(fileName, "g"),
          manifest[fileName].file
        );
        console.log("REPLACING", fileName, "with", manifest[fileName].file);
      }
    });

    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, "utf-8");

    console.log(`Prerendered: ${fileName}`);
  }

  await vite.close();
}

(async () => {
  if (process.argv.includes("--ssg")) {
    console.info("Detected --ssg flag - generating static routes...");
    await generateStaticPages();
  } else {
    createServer();
  }
})();
