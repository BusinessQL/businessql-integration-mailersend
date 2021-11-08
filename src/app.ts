// Copyright (c) Alex Ellis 2021. All rights reserved.
// Copyright (c) OpenFaaS Author(s) 2021. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

'use strict';

import express from 'express';
const app = express();
import handler from './handler';

const defaultMaxSize = '100kb'; // body-parser default

app.disable('x-powered-by');

const rawLimit = process.env.MAX_RAW_SIZE || defaultMaxSize;
const jsonLimit = process.env.MAX_JSON_SIZE || defaultMaxSize;

app.use(function addDefaultContentType(req: any, res: any, next: any) {
  // When no content-type is given, the body element is set to
  // nil, and has been a source of contention for new users.

  if (!req.headers['content-type']) {
    req.headers['content-type'] = 'application/json';
  }
  next();
});

if (process.env.RAW_BODY === 'true') {
  app.use(express.raw({ type: '*/*', limit: rawLimit }));
} else {
  app.use(express.text({ type: 'text/*' }));
  app.use(express.json({ limit: jsonLimit }));
  app.use(express.urlencoded({ extended: true }));
}

const isArray = (a: any) => {
  return !!a && a.constructor === Array;
};

const isObject = (a: any) => {
  return !!a && a.constructor === Object;
};

class FunctionEvent {
  body: any;
  headers: any;
  method: string;
  query: any;
  path: string;

  constructor(req: any) {
    this.body = req.body;
    this.headers = req.headers;
    this.method = req.method;
    this.query = req.query;
    this.path = req.path;
  }
}

class FunctionContext {
  statusCode: string | number;
  cb: any;
  headerValues: any;
  cbCalled: number;

  constructor(cb: any) {
    this.statusCode = 200;
    this.cb = cb;
    this.headerValues = {};
    this.cbCalled = 0;
  }

  status(statusCode?: string | number) {
    if (!statusCode) {
      return this.statusCode;
    }

    this.statusCode = statusCode;
    return this;
  }

  headers(value?: any) {
    if (!value) {
      return this.headerValues;
    }

    this.headerValues = value;
    return this;
  }

  succeed(value: any) {
    let err;
    this.cbCalled++;
    this.cb(err, value);
  }

  fail(value: any) {
    let message;
    if (this.status() === '200') {
      this.status(500);
    }

    this.cbCalled++;
    this.cb(value, message);
  }
}

const middleware = async (req: any, res: any) => {
  const cb = (err: any, functionResult?: any) => {
    if (err) {
      console.error(err);

      return res
        .status(fnContext.status())
        .send(err.toString ? err.toString() : err);
    }

    if (isArray(functionResult) || isObject(functionResult)) {
      res
        .set(fnContext.headers())
        .status(fnContext.status())
        .send(JSON.stringify(functionResult));
    } else {
      res
        .set(fnContext.headers())
        .status(fnContext.status())
        .send(functionResult);
    }
  };

  const fnEvent = new FunctionEvent(req);
  const fnContext = new FunctionContext(cb);

  Promise.resolve(handler(fnEvent, fnContext))
    .then((res) => {
      if (!fnContext.cbCalled) {
        fnContext.succeed(res);
      }
    })
    .catch((e) => {
      console.log(e);
      // cb(e);
    });
};

app.post('/*', middleware);
app.get('/*', middleware);
app.patch('/*', middleware);
app.put('/*', middleware);
app.delete('/*', middleware);
app.options('/*', middleware);

const port = process.env.http_port || 5555;

app.listen(port, () => {
  console.log(`bql-integration-mailersend:0.0.3-test`);
  console.log(`http://localhost:${port}`);
});
