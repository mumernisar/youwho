import { parse, type Node } from 'acorn';

/**
 * Canonical text of a page script for picking a decoder. The scraper hashes it, so two scripts get the
 * same hash only when their code is the same and the differences are display text.
 *
 * The script is parsed, so whitespace, comments and line breaks never count, and every piece of code
 * does: an added, removed or changed statement anywhere gives a new hash. Only two kinds of display
 * text are ignored, and only outside the data-reading parts:
 *   - the text of template literals (the page's HTML), unless it could run code;
 *   - the contents of arrays and objects made only of constants (the list of exam days).
 * The data-reading parts (PARTS), and every declaration they use, followed transitively, are kept
 * exactly, constants included.
 *
 * Fails safe: a script that does not parse, or in which any part is missing or found twice, is
 * returned whole, so it never matches a registered decoder and the owner is emailed.
 */
export function logicFingerprint(script: string): string {
  let program: Node;
  try {
    program = parse(script, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch {
    return whole(script);
  }
  const kept = keptNodes(program);
  if (!kept) return whole(script);
  return `ast1:${canonical(program, { kept, inKept: false, verbatim: false })}`;
}

/** A different prefix, so a whole-script fingerprint can never equal a parsed one. */
const whole = (script: string) => `raw:${script.replace(/\s+/g, '')}`;

type AnyNode = Node & Record<string, unknown>;

const isNode = (v: unknown): v is AnyNode =>
  typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string';
const isId = (v: unknown, name?: string): boolean =>
  isNode(v) && v.type === 'Identifier' && (name === undefined || v.name === name);
const isMember = (v: unknown, object: string, property: string): boolean =>
  isNode(v) && v.type === 'MemberExpression' && !v.computed && isId(v.object, object) && isId(v.property, property);
const isCallOf = (v: unknown, test: (callee: unknown) => boolean): boolean =>
  isNode(v) && v.type === 'CallExpression' && test(v.callee);

/** The statements of the v1 page script that read the data. Each must match exactly one node. */
const PARTS: readonly ((n: AnyNode) => boolean)[] = [
  // const B = (x) => parseInt(x, 36): the base-36 reader
  (n) => n.type === 'VariableDeclarator' && isId(n.id, 'B'),
  // for (const [pre, str] of Object.entries(D.groups)) ...: student rows
  (n) =>
    n.type === 'ForOfStatement' &&
    isCallOf(n.right, (c) => isMember(c, 'Object', 'entries')) &&
    isMember((n.right as AnyNode).arguments && ((n.right as AnyNode).arguments as unknown[])[0], 'D', 'groups'),
  // function decode(enc, home): seat codes
  (n) => n.type === 'FunctionDeclaration' && isId(n.id, 'decode'),
  // function seatInfo(room, seat): clash, extra and grid seat labels
  (n) => n.type === 'FunctionDeclaration' && isId(n.id, 'seatInfo'),
  // const [, name, hc, enc] = st: a row's fields
  (n) =>
    n.type === 'VariableDeclarator' &&
    isNode(n.id) &&
    n.id.type === 'ArrayPattern' &&
    JSON.stringify((n.id.elements as unknown[]).map((e) => (isId(e) ? (e as AnyNode).name : null))) === '[null,"name","hc","enc"]' &&
    isId(n.init, 'st'),
  // const home = B(hc): home section
  (n) => n.type === 'VariableDeclarator' && isId(n.id, 'home') && isCallOf(n.init, (c) => isId(c, 'B')),
  // const papers = decode(enc, home).map(...): indexes into slots, courses, sections and rooms
  (n) =>
    n.type === 'VariableDeclarator' &&
    isId(n.id, 'papers') &&
    isCallOf(n.init, (c) => isNode(c) && c.type === 'MemberExpression' && isCallOf(c.object, (d) => isId(d, 'decode'))),
];

/** Every node in the tree, parents before children. */
function* walk(node: AnyNode): Generator<AnyNode> {
  yield node;
  for (const [key, value] of Object.entries(node)) {
    if (SKIP.has(key)) continue;
    for (const child of Array.isArray(value) ? value : [value]) if (isNode(child)) yield* walk(child);
  }
}

/** Position and source-text fields: never part of the fingerprint. */
const SKIP = new Set(['start', 'end', 'loc', 'range', 'raw']);

/** What the script does with one name. */
interface Binding {
  /** Statements that give it a value: its declaration and every reassignment. */
  writes: AnyNode[];
  /** Statements that may change the object it holds: member assignments, mutating calls, unknown calls it is given to. */
  mutations: AnyNode[];
  /** Names that may hold (part of) the same object, so changes made through them change this one too. */
  aliases: Binding[];
  /** The function it is a parameter of. */
  paramOf: AnyNode | null;
  /** Calls through this name, for when it holds a function. */
  calls: AnyNode[];
  /** Not declared by the script: a browser global such as `document` or `parseInt`. */
  implicit: boolean;
  name: string;
}

class Scope {
  readonly names = new Map<string, Binding>();
  constructor(
    readonly parent: Scope | null,
    readonly isFunction: boolean,
  ) {}
  declare(name: string, implicit = false): Binding {
    let b = this.names.get(name);
    if (!b) this.names.set(name, (b = { writes: [], mutations: [], aliases: [], paramOf: null, calls: [], implicit, name }));
    return b;
  }
  lookup(name: string): Binding | null {
    return this.names.get(name) ?? this.parent?.lookup(name) ?? null;
  }
  get functionScope(): Scope {
    return this.isFunction || !this.parent ? this : this.parent.functionScope;
  }
}

/** Names a pattern binds: `x`, `[a, , b]`, `{ k: v, ...rest }`, `c = 1`. */
function* patternNames(p: unknown): Generator<string> {
  if (!isNode(p)) return;
  if (p.type === 'Identifier') yield p.name as string;
  else if (p.type === 'ArrayPattern') for (const e of p.elements as unknown[]) yield* patternNames(e);
  else if (p.type === 'ObjectPattern') for (const prop of p.properties as AnyNode[]) yield* patternNames(prop.type === 'RestElement' ? prop.argument : prop.value);
  else if (p.type === 'AssignmentPattern') yield* patternNames(p.left);
  else if (p.type === 'RestElement') yield* patternNames(p.argument);
}

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const BLOCKS = new Set(['BlockStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement', 'CatchClause', 'StaticBlock', 'ClassBody']);

/** Methods that change neither the object they are called on nor their arguments. Callbacks given to them still see the object's elements. */
const PURE_METHODS = new Set([
  'at', 'charAt', 'charCodeAt', 'codePointAt', 'concat', 'endsWith', 'entries', 'every', 'exec', 'filter', 'find', 'findIndex',
  'findLast', 'findLastIndex', 'flat', 'flatMap', 'forEach', 'get', 'getAttribute', 'getElementById', 'getItem', 'has', 'includes',
  'indexOf', 'isArray', 'join', 'keys', 'lastIndexOf', 'localeCompare', 'map', 'match', 'matchAll', 'padEnd', 'padStart', 'parse',
  'querySelector', 'querySelectorAll', 'reduce', 'reduceRight', 'repeat', 'replace', 'replaceAll', 'search', 'slice', 'some', 'split',
  'startsWith', 'stringify', 'substr', 'substring', 'test', 'toFixed', 'toLocaleString', 'toLowerCase', 'toString', 'toUpperCase',
  'trim', 'trimEnd', 'trimStart', 'values',
]);
/** Browser globals that return a new value built from their arguments, while the script does not reassign them. */
const PURE_FUNCTIONS = new Set(['String', 'Number', 'Boolean', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Map', 'Set', 'Date', 'RegExp']);
/** Of those, the ones whose result holds its arguments' objects. */
const HOLDS_ARGUMENTS = new Set(['Map', 'Set', 'concat']);
/**
 * Browser objects the data never comes back from: the plan is parsed from the page once, at the start,
 * so writing the page's HTML or local storage cannot change it. Changes to them are not followed.
 */
const OPAQUE = new Set(['document', 'localStorage', 'sessionStorage', 'console', 'navigator', 'location', 'history']);

/** Where a function's value comes from: its returned (and yielded or thrown) expressions, not those of nested functions. */
function returnSites(fn: AnyNode): AnyNode[] {
  if (fn.type === 'ArrowFunctionExpression' && fn.expression) return [fn.body as AnyNode];
  const out: AnyNode[] = [];
  const visit = (n: AnyNode) => {
    if ((n.type === 'ReturnStatement' || n.type === 'ThrowStatement' || n.type === 'YieldExpression') && isNode(n.argument)) out.push(n.argument);
    for (const [key, value] of Object.entries(n)) {
      if (SKIP.has(key)) continue;
      for (const child of Array.isArray(value) ? value : [value]) if (isNode(child) && !FUNCTIONS.has(child.type)) visit(child);
    }
  };
  visit(fn.body as AnyNode);
  return out;
}

/** Is `node`, found under `parent[key]`, a name being read (not a property name, label or declaration)? */
function isReference(parent: AnyNode | null, key: string): boolean {
  if (!parent) return true;
  if (parent.type === 'MemberExpression' && key === 'property') return Boolean(parent.computed);
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key') return Boolean(parent.computed);
  if (parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') return false;
  if (parent.type === 'MetaProperty') return false;
  if (parent.type === 'VariableDeclarator' && key === 'id') return false;
  if (FUNCTIONS.has(parent.type) && (key === 'id' || key === 'params')) return false;
  if ((parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression') && key === 'id') return false;
  if (parent.type === 'CatchClause' && key === 'param') return false;
  return true;
}

/**
 * Lexical scopes and data flow for the whole script: for every name read, the binding it reads, and for
 * every binding, what writes it, what may change its object and which names share that object. Where
 * the language is loose (sloppy-mode function hoisting, calls to unknown code) the analysis assumes
 * the worst, which can only keep more, never less.
 */
function analyse(program: AnyNode) {
  const scopeOf = new Map<AnyNode, Scope>();
  const global = new Scope(null, true);
  const fnScope = new Map<AnyNode, Scope>();
  // Function node ↔ the names it can be called through.
  const namesOf = new Map<AnyNode, Binding[]>();
  const fnsOf = new Map<Binding, AnyNode[]>();
  const nameFunction = (fn: unknown, b: Binding | null) => {
    if (!b || !isNode(fn) || !FUNCTIONS.has(fn.type)) return;
    namesOf.set(fn, [...(namesOf.get(fn) ?? []), b]);
    fnsOf.set(b, [...(fnsOf.get(b) ?? []), fn]);
  };
  const declareAll = (scope: Scope, pattern: unknown, decl: AnyNode) => {
    for (const name of patternNames(pattern)) scope.declare(name).writes.push(decl);
  };
  // A parameter's value comes from the calls (followed through paramOf), and its default from the pattern.
  const declareParam = (scope: Scope, pattern: AnyNode, fn: AnyNode) => {
    for (const name of patternNames(pattern)) {
      const b = scope.declare(name);
      b.paramOf = fn;
      if (pattern.type !== 'Identifier') b.writes.push(pattern);
    }
  };

  // Pass 1: scopes and declarations (hoisted, so a name can be read before its declaration).
  const declare = (node: AnyNode, scope: Scope) => {
    scopeOf.set(node, scope);
    let inner = scope;
    if (FUNCTIONS.has(node.type)) {
      inner = new Scope(scope, true);
      fnScope.set(node, inner);
      if (node.type === 'FunctionDeclaration' && isId(node.id)) {
        const name = (node.id as AnyNode).name as string;
        declareAll(scope, node.id, node);
        nameFunction(node, scope.lookup(name));
        if (scope.functionScope !== scope) {
          declareAll(scope.functionScope, node.id, node);
          nameFunction(node, scope.functionScope.lookup(name));
        }
      }
      if (node.type === 'FunctionExpression' && isId(node.id)) {
        declareAll(inner, node.id, node);
        nameFunction(node, inner.lookup((node.id as AnyNode).name as string));
      }
      for (const p of node.params as AnyNode[]) declareParam(inner, p, node);
      inner.declare('arguments').paramOf = node;
    } else if (BLOCKS.has(node.type)) {
      inner = new Scope(scope, false);
      if (node.type === 'CatchClause' && isNode(node.param)) declareAll(inner, node.param, node.param);
    } else if (node.type === 'ClassDeclaration' && isId(node.id)) {
      declareAll(scope, node.id, node);
    } else if (node.type === 'VariableDeclaration') {
      const target = node.kind === 'var' ? scope.functionScope : scope;
      for (const d of node.declarations as AnyNode[]) {
        declareAll(target, d.id, d);
        if (isId(d.id)) nameFunction(d.init, target.lookup((d.id as AnyNode).name as string));
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (SKIP.has(key)) continue;
      for (const child of Array.isArray(value) ? value : [value]) {
        if (!isNode(child)) continue;
        // A function's body block shares the function's scope, so its parameters and `var`s meet.
        if (FUNCTIONS.has(node.type) && key === 'body' && child.type === 'BlockStatement') {
          scopeOf.set(child, inner);
          for (const stmt of child.body as AnyNode[]) declare(stmt, inner);
        } else declare(child, inner);
      }
    }
  };
  declare(program, global);

  // Pass 2: resolve every name read; note writes, mutations and calls. Aliases need every read
  // resolved first, so they are linked afterwards.
  const reads = new Map<AnyNode, Binding>();
  const later: (() => void)[] = [];
  const resolve = (scope: Scope, name: string): Binding => scope.lookup(name) ?? global.declare(name, true);
  /**
   * Names whose objects the value of `n` may hold. `a[i]` holds part of `a`, not `i`; a function value
   * holds none of what its body reads; a call holds what its function returns, a pure method's result
   * what its receiver (and callbacks) hold, and a call to code we cannot see anything it touches.
   */
  const readsIn = (n: unknown, seen = new Set<AnyNode>()): Binding[] => {
    if (!isNode(n) || FUNCTIONS.has(n.type) || seen.has(n)) return [];
    seen.add(n);
    if (reads.has(n)) return [reads.get(n)!];
    if (n.type === 'MemberExpression') return readsIn(n.object, seen);
    if (n.type === 'CallExpression' || n.type === 'NewExpression') {
      const callee = n.callee as AnyNode;
      const args = n.arguments as AnyNode[];
      const argsIn = () => args.flatMap((a) => readsIn(a.type === 'SpreadElement' ? a.argument : a, seen));
      const returnsOf = (fns: AnyNode[]) => fns.flatMap((fn) => returnSites(fn).flatMap((site) => readsIn(site, seen)));
      if (isId(callee)) {
        const b = reads.get(callee)!;
        const fns = fnsOf.get(b) ?? [];
        if (fns.length > 0) return returnsOf(fns);
        if (b.implicit && PURE_FUNCTIONS.has(b.name)) return HOLDS_ARGUMENTS.has(b.name) ? argsIn() : [];
      } else if (callee.type === 'MemberExpression' && !callee.computed && isId(callee.property) && PURE_METHODS.has((callee.property as AnyNode).name as string)) {
        const method = (callee.property as AnyNode).name as string;
        const callbacks = returnsOf(args.filter((a) => FUNCTIONS.has(a.type)));
        return [...readsIn(callee.object, seen), ...callbacks, ...(HOLDS_ARGUMENTS.has(method) ? argsIn() : [])];
      }
      return [...readsIn(callee, seen), ...argsIn()];
    }
    const out: Binding[] = [];
    for (const [key, value] of Object.entries(n)) {
      if (SKIP.has(key)) continue;
      for (const child of Array.isArray(value) ? value : [value]) out.push(...readsIn(child, seen));
    }
    return out;
  };
  /** `node` may change the object `receiver` evaluates to, so it changes every name that object may come from. */
  const mutates = (receiver: unknown, node: AnyNode) =>
    later.push(() => {
      for (const b of readsIn(receiver)) b.mutations.push(node);
    });
  /** `target` gets the value of `value`: target's names may now share objects with every name value reads. */
  const flowsInto = (value: unknown, targets: () => Binding[]) =>
    later.push(() => {
      for (const from of readsIn(value)) for (const t of targets()) from.aliases.push(t);
    });
  const assign = (scope: Scope, target: unknown, node: AnyNode, value: unknown) => {
    if (isNode(target) && (target.type === 'MemberExpression' || target.type === 'ChainExpression')) {
      // Changes the object it is a member of, which may now also hold the value's objects.
      const object = target.type === 'MemberExpression' ? target.object : target.expression;
      mutates(object, node);
      later.push(() => {
        const into = readsIn(object);
        for (const from of readsIn(value)) for (const t of into) from.aliases.push(t);
      });
    } else {
      // `[a, D.rooms[0]] = x` both rebinds `a` and changes `D.rooms`.
      if (isNode(target)) for (const m of walk(target)) if (m.type === 'MemberExpression') mutates(m.object, node);
      const names = [...patternNames(target)];
      for (const name of names) resolve(scope, name).writes.push(node);
      flowsInto(value, () => names.map((n) => resolve(scope, n)));
    }
  };
  /** Parameters that receive argument `i` of a call to `fn`, and its `arguments`. */
  const paramsFor = (fn: AnyNode, i: number, spread: boolean): Binding[] => {
    const inner = fnScope.get(fn)!;
    const params = fn.params as AnyNode[];
    const chosen = spread ? params : params.slice(i, i + 1).concat(params.filter((p, j) => j < i && p.type === 'RestElement'));
    return [...chosen.flatMap((p) => [...patternNames(p)]), 'arguments'].map((n) => inner.names.get(n)!).filter(Boolean);
  };
  /** Arguments handed to code we cannot see may be changed by it. */
  const unknownCall = (node: AnyNode) => {
    for (const arg of node.arguments as AnyNode[]) mutates(arg.type === 'SpreadElement' ? arg.argument : arg, node);
  };

  const visit = (node: AnyNode, parent: AnyNode | null, key: string) => {
    const scope = scopeOf.get(node)!;
    if (node.type === 'Identifier' && isReference(parent, key)) reads.set(node, resolve(scope, node.name as string));
    if (node.type === 'VariableDeclarator' && node.init) {
      const names = [...patternNames(node.id)];
      flowsInto(node.init, () => names.map((n) => scope.lookup(n)!).filter(Boolean));
    }
    if (node.type === 'AssignmentExpression') assign(scope, node.left, node, node.right);
    if (node.type === 'UpdateExpression' || (node.type === 'UnaryExpression' && node.operator === 'delete')) assign(scope, node.argument, node, null);
    if ((node.type === 'ForInStatement' || node.type === 'ForOfStatement') && isNode(node.left) && node.left.type !== 'VariableDeclaration') {
      assign(scope, node.left, node, node.right);
    }
    if ((node.type === 'ForInStatement' || node.type === 'ForOfStatement') && isNode(node.left) && node.left.type === 'VariableDeclaration') {
      const names = (node.left.declarations as AnyNode[]).flatMap((d) => [...patternNames(d.id)]);
      const inner = scopeOf.get(node.left)!;
      flowsInto(node.right, () => names.map((n) => inner.lookup(n)!).filter(Boolean));
    }
    if (node.type === 'CallExpression' || node.type === 'NewExpression') {
      const callee = node.callee as AnyNode;
      const args = node.arguments as AnyNode[];
      if (isId(callee)) {
        const b = resolve(scope, callee.name as string);
        b.calls.push(node);
        const fns = fnsOf.get(b) ?? [];
        if (fns.length > 0) {
          // A function of the script: each argument's objects are shared with the parameter that receives it.
          args.forEach((arg, i) => {
            const spread = arg.type === 'SpreadElement';
            flowsInto(spread ? arg.argument : arg, () => fns.flatMap((fn) => paramsFor(fn, i, spread)));
          });
        } else if (!(b.implicit && PURE_FUNCTIONS.has(callee.name as string))) unknownCall(node);
      } else if (callee.type === 'MemberExpression' && !callee.computed && isId(callee.property) && PURE_METHODS.has((callee.property as AnyNode).name as string)) {
        // Changes nothing itself, but a callback (or a function passed by name) sees the receiver's elements.
        for (const arg of args) {
          const fns = FUNCTIONS.has(arg.type) ? [arg] : isId(arg) ? (fnsOf.get(resolve(scope, arg.name as string)) ?? []) : [];
          for (const fn of fns) flowsInto(callee.object, () => (fn.params as AnyNode[]).flatMap((_, i) => paramsFor(fn, i, false)));
        }
      } else {
        // A method that may change its object, or a callee we cannot see.
        if (callee.type === 'MemberExpression') mutates(callee.object, node);
        unknownCall(node);
      }
    }
    for (const [k, value] of Object.entries(node)) {
      if (SKIP.has(k)) continue;
      for (const child of Array.isArray(value) ? value : [value]) if (isNode(child)) visit(child, node, k);
    }
  };
  visit(program, null, '');
  for (const link of later) link();
  return { reads, namesOf, fnsOf, global };
}

/** Elements whose content or attributes run as code. */
const RUNNABLE_ELEMENTS = /^(script|iframe|frame|object|embed|base|meta|link)$/i;

/**
 * Code this analysis cannot follow: running strings (eval, string timers, dynamic import), changing
 * scope (`with`), objects reached through `this`, or creating elements that run their content.
 */
function runsDynamicCode(all: AnyNode[]): boolean {
  return all.some((n) => {
    if (n.type === 'WithStatement' || n.type === 'ImportExpression' || n.type === 'ThisExpression' || n.type === 'Super') return true;
    if (n.type !== 'CallExpression' && n.type !== 'NewExpression') return false;
    const name = calleeName(n.callee);
    if (name === 'eval' || name === 'Function' || name === 'execScript') return true;
    if (name === 'createElement' || name === 'createElementNS') {
      const tag = (n.arguments as AnyNode[])[name === 'createElement' ? 0 : 1];
      return !(isNode(tag) && tag.type === 'Literal' && typeof tag.value === 'string' && !RUNNABLE_ELEMENTS.test(tag.value));
    }
    // Timers given a string instead of a function.
    const first = (n.arguments as AnyNode[])[0];
    return (name === 'setTimeout' || name === 'setInterval') && first !== undefined && !FUNCTIONS.has(first.type) && !isId(first);
  });
}

/**
 * The parts, plus everything that can change what they read: for each name a kept node reads, the
 * statements that give it a value, and the statements that may change its object through it or any
 * name sharing that object; for a parameter, the arguments at every call; and every change to a
 * browser global, which all code shares. Followed until nothing new is added. Null if a part is
 * missing or ambiguous, or the script runs code this cannot follow.
 */
function keptNodes(program: Node): Set<AnyNode> | null {
  const root = program as AnyNode;
  const all = [...walk(root)];
  if (runsDynamicCode(all)) return null;
  const kept = new Set<AnyNode>();
  for (const test of PARTS) {
    const hits = all.filter(test);
    if (hits.length !== 1) return null;
    kept.add(hits[0]!);
  }
  const { reads, namesOf, fnsOf, global } = analyse(root);
  const queue = [...kept];
  const keep = (n: AnyNode) => {
    if (!kept.has(n)) {
      kept.add(n);
      queue.push(n);
    }
  };
  const followedMutations = new Set<Binding>();
  const followMutations = (b: Binding) => {
    if (followedMutations.has(b) || (b.implicit && OPAQUE.has(b.name))) return;
    followedMutations.add(b);
    b.mutations.forEach(keep);
    b.aliases.forEach(followMutations);
  };
  const followed = new Set<Binding>();
  const follow = (b: Binding) => {
    if (followed.has(b)) return;
    followed.add(b);
    // A function's value is what it returns. What else its body does is tracked on the names it changes.
    const fns = fnsOf.get(b) ?? [];
    for (const w of b.writes) {
      if (FUNCTIONS.has(w.type) && fns.includes(w)) returnSites(w).forEach(keep);
      else if (w.type === 'VariableDeclarator' && isNode(w.init) && fns.includes(w.init)) returnSites(w.init).forEach(keep);
      else keep(w);
    }
    followMutations(b);
    // A parameter is supplied by the arguments at each call; the callee is the function itself.
    if (b.paramOf) for (const name of namesOf.get(b.paramOf) ?? []) for (const call of name.calls) (call.arguments as AnyNode[]).forEach(keep);
  };
  // Changes to shared built-ins (String.prototype.split = ...) reach every part.
  for (const b of global.names.values()) if (b.implicit && !OPAQUE.has(b.name)) [...b.writes, ...b.mutations].forEach(keep);
  while (queue.length > 0) {
    for (const n of walk(queue.pop()!)) {
      const b = reads.get(n);
      if (b) follow(b);
    }
  }
  return kept;
}

interface Ctx {
  kept: ReadonlySet<AnyNode>;
  /** Inside a kept node: nothing is ignored. */
  inKept: boolean;
  /** Inside code whose strings may run (eval, timers, document.write, tagged templates): nothing is ignored. */
  verbatim: boolean;
}

/** Callees whose string arguments become markup or attributes that can run scripts. (eval and the like make the whole script unfollowable.) */
const RUNS_STRINGS = new Set(['write', 'writeln', 'setAttribute', 'setAttributeNS', 'insertAdjacentHTML', 'open', 'assign', 'replace']);
/** Properties that load or run what is assigned to them. A computed name could be any of them. */
const RUNS_PROPERTY = /^(on.*|src|srcdoc|href|action|formAction|data|text|computed|cssText|outerHTML)$/i;

function memberName(m: AnyNode): string | null {
  return !m.computed && isId(m.property) ? ((m.property as AnyNode).name as string) : null;
}
/** Markup that can run code when inserted, even through innerHTML. */
const RUNNABLE_MARKUP = /<\s*(script|iframe|object|embed|frame|meta|link|base)\b|\bon[a-z]+\s*=|javascript\s*:|srcdoc|\bimport\s*\(/i;

function calleeName(callee: unknown): string | null {
  if (isId(callee)) return (callee as AnyNode).name as string;
  if (isNode(callee) && callee.type === 'MemberExpression' && !callee.computed && isId(callee.property)) return (callee.property as AnyNode).name as string;
  return null;
}

/** Literals, and arrays and objects made only of them. */
function isConstant(n: unknown): boolean {
  if (!isNode(n)) return false;
  switch (n.type) {
    case 'Literal':
      return !n.regex;
    case 'UnaryExpression':
      return (n.operator === '-' || n.operator === '+') && isConstant(n.argument);
    case 'TemplateLiteral':
      return (n.expressions as unknown[]).length === 0;
    case 'ArrayExpression':
      return (n.elements as unknown[]).every((e) => e === null || isConstant(e));
    case 'ObjectExpression':
      return (n.properties as unknown[]).every(
        (p) =>
          isNode(p) &&
          p.type === 'Property' &&
          p.kind === 'init' &&
          !p.method &&
          !p.shorthand &&
          !p.computed &&
          (isId(p.key) || (isNode(p.key) && p.key.type === 'Literal')) &&
          isConstant(p.value),
      );
    default:
      return false;
  }
}

function templateText(n: AnyNode): string {
  return (n.quasis as AnyNode[]).map((q) => (q.value as { cooked: string | null; raw: string }).raw).join('');
}

/** Stable text for a node: sorted keys, positions and source text dropped, display text blanked. */
function canonical(value: unknown, ctx: Ctx): string {
  if (Array.isArray(value)) return `[${value.map((v) => canonical(v, ctx)).join(',')}]`;
  if (!isNode(value)) return JSON.stringify(value ?? null);
  const n = value;
  const inKept = ctx.inKept || ctx.kept.has(n);
  let verbatim = ctx.verbatim;
  if (n.type === 'TaggedTemplateExpression') verbatim = true;
  if ((n.type === 'CallExpression' || n.type === 'NewExpression') && RUNS_STRINGS.has(calleeName(n.callee) ?? '')) verbatim = true;
  // Attributes, and properties that load or run what they are given, are never display text.
  if (n.type === 'AssignmentExpression' && isNode(n.left) && n.left.type === 'MemberExpression' && RUNS_PROPERTY.test(memberName(n.left) ?? 'computed')) verbatim = true;
  const exact = inKept || verbatim;

  if (!exact && (n.type === 'ArrayExpression' || n.type === 'ObjectExpression') && isConstant(n)) return `{"type":"Constant${n.type}"}`;
  if (!exact && n.type === 'TemplateLiteral' && !RUNNABLE_MARKUP.test(templateText(n))) {
    return `{"expressions":${canonical(n.expressions, { ...ctx, inKept, verbatim })},"quasis":${(n.quasis as unknown[]).length},"type":"TemplateLiteral"}`;
  }

  const fields = Object.keys(n)
    .filter((k) => !SKIP.has(k))
    .sort()
    .map((k) => {
      let v: unknown = n[k];
      // A regex or BigInt's value is an object JSON cannot show; its `regex` or `bigint` field holds it.
      if (n.type === 'Literal' && k === 'value' && (n.regex || n.bigint)) v = null;
      return `${JSON.stringify(k)}:${canonical(v, { ...ctx, inKept, verbatim })}`;
    });
  return `{${fields.join(',')}}`;
}
