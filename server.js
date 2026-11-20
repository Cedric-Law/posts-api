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
// Ne vérifie que les champs présents dans `data` : le "requis" est géré par l'appelant.
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

const app = new Koa();
const router = new Router();

app.use(async (ctx, next) => {
  try {
    await next();

    if (ctx.status === 404 && ctx.body === undefined) {
      ctx.status = 404;
      ctx.body = { error: 'Route introuvable' };
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
    ctx.status = 400;
    ctx.body = { error: 'postId doit être un entier >= 1' };
    return;
  }

  ctx.body = posts.filter((post) => post.postId === n);
});

router.get('/posts/:id', (ctx) => {
  const id = Number(ctx.params.id);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    ctx.status = 404;
    ctx.body = { error: 'Post introuvable' };
    return;
  }

  ctx.body = post;
});

router.post('/posts', (ctx) => {
  const data = ctx.request.body;

  const error = validateComplete(data);
  if (error) {
    ctx.status = 400;
    ctx.body = { error };
    return;
  }

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

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);