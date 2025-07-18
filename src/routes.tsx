import type { RouteProps } from "react-router";
import { matchPath } from "react-router";
import Async from "~/components/Async";

interface Route {
  path: string;
  import: () => Promise<{ default: React.FC; fetchData?: FetchDataFunc }>;
}

type RouteExtended = RouteProps & {
  data?: { head: SEO };
};

const routes: Route[] = [
  { path: "/", import: () => import("~/pages") },
  { path: "/prerender", import: () => import("~/pages/prerender") },
  { path: "/:name", import: () => import("~/pages/ssr") },
];

const isServerSide = typeof window === "undefined";

export default async (
  url: string
): Promise<{ routes: RouteExtended[]; head?: SEO; context: any }> => {
  const allRoutes: RouteExtended[] = [];
  let head: SEO | undefined;
  let context: any;

  for (const route of routes) {
    let element: React.ReactNode;
    const match = matchPath(route.path, url);

    // For the server-side application, we do not need code-splitting.
    // Also, this will ensure the server-side build is compatible with
    // serverless environments.
    if (isServerSide) {
      const mod = await route.import();
      element = <mod.default />;

      if (match) {
        const data = await mod?.fetchData?.(
          match.params as Record<string, string>
        );

        if (data?.head) {
          head = data.head;
        }

        if (data?.context) {
          context = data.context;
        }
      }
    } else if (!isServerSide) {
      element = Async(route.path, route.import);
    }

    allRoutes.push({ path: route.path, element });
  }

  return { routes: allRoutes, head, context };
};
