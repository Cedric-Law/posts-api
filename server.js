import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import fs from 'node:fs';

const posts = JSON.parse(fs.readFileSync('post.seed.json', 'utf-8'));

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

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);