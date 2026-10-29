/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountRules from "../accountRules.js";
import type * as babosoraApplier from "../babosoraApplier.js";
import type * as catalog from "../catalog.js";
import type * as catalogScope from "../catalogScope.js";
import type * as classBoard from "../classBoard.js";
import type * as classBoardRules from "../classBoardRules.js";
import type * as codes from "../codes.js";
import type * as discussion from "../discussion.js";
import type * as discussionAccess from "../discussionAccess.js";
import type * as discussionSummary from "../discussionSummary.js";
import type * as helpers from "../helpers.js";
import type * as notifications from "../notifications.js";
import type * as qlctCourse from "../qlctCourse.js";
import type * as reads from "../reads.js";
import type * as seed from "../seed.js";
import type * as vabixApplier from "../vabixApplier.js";
import type * as writes from "../writes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountRules: typeof accountRules;
  babosoraApplier: typeof babosoraApplier;
  catalog: typeof catalog;
  catalogScope: typeof catalogScope;
  classBoard: typeof classBoard;
  classBoardRules: typeof classBoardRules;
  codes: typeof codes;
  discussion: typeof discussion;
  discussionAccess: typeof discussionAccess;
  discussionSummary: typeof discussionSummary;
  helpers: typeof helpers;
  notifications: typeof notifications;
  qlctCourse: typeof qlctCourse;
  reads: typeof reads;
  seed: typeof seed;
  vabixApplier: typeof vabixApplier;
  writes: typeof writes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
