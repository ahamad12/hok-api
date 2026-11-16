// Route shadowing guard: Express matches routes in registration order, and Nest
// registers a controller's handlers in declaration order (MetadataScanner walks
// Object.getOwnPropertyNames(prototype)). A param route like GET /shops/:id
// declared before GET /shops/my swallows it (id="my" → ShopAccessGuard 403).
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { shopContract } from "@tapt-api/api/contracts/shop.contract";
import { describe, expect, it } from "vitest";
import { ShopController } from "../shop.controller";

interface Route {
  name: string;
  method: string;
  path: string;
}

/** True when `earlier` (which may contain :params) would also match `later`. */
function shadows(earlier: Route, later: Route): boolean {
  if (earlier.method !== later.method) return false;
  const a = earlier.path.split("/");
  const b = later.path.split("/");
  if (a.length !== b.length) return false;
  const differs = a.some((seg, i) => seg !== b[i]);
  return differs && a.every((seg, i) => seg.startsWith(":") || seg === b[i]);
}

function findShadowing(routes: Route[]): string[] {
  const problems: string[] = [];
  routes.forEach((later, j) => {
    for (const earlier of routes.slice(0, j)) {
      if (shadows(earlier, later)) {
        problems.push(`${earlier.method} ${earlier.path} (${earlier.name}) shadows ${later.path}`);
      }
    }
  });
  return problems;
}

function controllerRoutes(): Route[] {
  const proto = ShopController.prototype as unknown as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== "constructor")
    .flatMap((name) => {
      const handler = proto[name] as object;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      return path === undefined || method === undefined
        ? []
        : [{ name, method: String(method), path }];
    });
}

describe("shop routes", () => {
  it("registers every contract route on the controller", () => {
    const paths = controllerRoutes().map((r) => r.path);
    for (const route of Object.values(shopContract)) {
      expect(paths).toContain(route.path);
    }
  });

  it("controller: no handler is shadowed by an earlier param route", () => {
    expect(findShadowing(controllerRoutes())).toEqual([]);
  });

  it("controller: GET /shops/my is declared before GET /shops/:id", () => {
    const names = controllerRoutes().map((r) => r.name);
    expect(names.indexOf("getMyShops")).toBeLessThan(names.indexOf("getById"));
  });

  it("contract: no route is shadowed by an earlier param route", () => {
    const routes = Object.entries(shopContract).map(([name, r]) => ({
      name,
      method: r.method,
      path: r.path,
    }));
    expect(findShadowing(routes)).toEqual([]);
  });

  it("the shadowing check catches the original bug", () => {
    expect(
      findShadowing([
        { name: "getById", method: "GET", path: "/api/v1/shops/:id" },
        { name: "getMyShops", method: "GET", path: "/api/v1/shops/my" },
      ]),
    ).toHaveLength(1);
  });
});
