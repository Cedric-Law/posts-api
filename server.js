import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import fs from 'node:fs';



// const post = JSON.parse(fs.readFileSync('post.seed.js', 'utf-8'));
const app = new Koa();
const router = new Router();

app.use(bodyParser());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000);