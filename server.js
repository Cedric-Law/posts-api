import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import fs from 'node:fs';

const posts = JSON.parse(fs.readFileSync('post.seed.json', 'utf-8'));
let nextId = Math.max(0, ...posts.map((p) => p.id)) + 1;

const FIELDS = ['postId', 'name', 'email', 'body'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNonEmptyString(value, max) {
  return typeof value === 'string' && value.length >= 1 && value.length <= max;
}

// Renvoie un message d'erreur, ou null si tout est valide.
// Ne vérifie que les champs présents : le "requis" est géré par validateComplete.
function validateFields(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return 'Le corps doit être un objet JSON';
  }

  for (const key of Object.keys(data)) {
    if (!FIELDS.includes(key)) {
      return `Champ inconnu : ${key}`;
    }
  }

  if ('postId' in data && (!Number.isInteger(data.postId) || data.postId < 1)) {
    return 'postId doit être un entier >= 1';
  }
  if ('name' in data && !isNonEmptyString(data.name, 100)) {
    return 'name doit être un texte de 1 à 100 caractères';
  }
  if ('email' in data && (!isNonEmptyString(data.email, 100) || !EMAIL_REGEX.test(data.email))) {
    return 'email doit être une adresse e-mail valide de 100 caractères au plus';
  }
  if ('body' in data && !isNonEmptyString(data.body, 500)) {
    return 'body doit être un texte de 1 à 500 caractères';
  }

  return null;
}

function validateComplete(data) {
  const error = validateFields(data);
  if (error) return error;

  const missing = FIELDS.find((key) => !(key in data));
  if (missing) return `Champ requis manquant : ${missing}`;

  return null;
}

function findIndexById(rawId) {
  const id = Number(rawId);
  return posts.findIndex((p) => p.id === id);
}

function notFound(ctx) {
  ctx.status = 404;
  ctx.body = { error: 'Post introuvable' };
}

function badRequest(ctx, error) {
  ctx.status = 400;
  ctx.body = { error };
}

const app = new Koa();
const router = new Router();

app.use(async (ctx, next) => {
  try {
    await next();

    if (ctx.status >= 400 && typeof ctx.body !== 'object') {
      const messages = {
        404: 'Route introuvable',
        405: 'Méthode non autorisée',
      };
      const status = ctx.status;
      ctx.body = { error: messages[status] ?? 'Requête invalide' };
      ctx.status = status;
    }
  } catch (err) {
    const status = (err.status >= 400 && err.status < 500) ? err.status : 500;

    ctx.status = status;
    ctx.body = {
      error: status === 500 ? 'Erreur interne du serveur' : err.message,
    };
  }
});

app.use(bodyParser());

router.get('/posts', (ctx) => {
  const { postId } = ctx.query;

  if (postId === undefined) {
    ctx.body = posts;
    return;
  }

  const n = Number(postId);
  if (!Number.isInteger(n) || n < 1) {
    return badRequest(ctx, 'postId doit être un entier >= 1');
  }

  ctx.body = posts.filter((post) => post.postId === n);
});

router.get('/posts/:id', (ctx) => {
  const index = findIndexById(ctx.params.id);
  if (index === -1) return notFound(ctx);

  ctx.body = posts[index];
});

router.post('/posts', (ctx) => {
  const data = ctx.request.body;

  const error = validateComplete(data);
  if (error) return badRequest(ctx, error);

  const post = {
    postId: data.postId,
    id: nextId++,
    name: data.name,
    email: data.email,
    body: data.body,
  };
  posts.push(post);

  ctx.status = 201;
  ctx.set('Location', `/posts/${post.id}`);
  ctx.body = post;
});

router.put('/posts/:id', (ctx) => {
  const index = findIndexById(ctx.params.id);
  if (index === -1) return notFound(ctx);

  const data = ctx.request.body;
  const error = validateComplete(data);
  if (error) return badRequest(ctx, error);

  posts[index] = {
    postId: data.postId,
    id: posts[index].id,
    name: data.name,
    email: data.email,
    body: data.body,
  };

  ctx.body = posts[index];
});

router.patch('/posts/:id', (ctx) => {
  const index = findIndexById(ctx.params.id);
  if (index === -1) return notFound(ctx);

  const data = ctx.request.body;
  const error = validateFields(data);
  if (error) return badRequest(ctx, error);

  if (Object.keys(data).length === 0) {
    return badRequest(ctx, 'Le corps ne doit pas être vide');
  }

  Object.assign(posts[index], data);

  ctx.body = posts[index];
});

router.delete('/posts/:id', (ctx) => {
  const index = findIndexById(ctx.params.id);
  if (index === -1) return notFound(ctx);

  posts.splice(index, 1);
  ctx.status = 204;
});

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);