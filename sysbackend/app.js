const oracledb = require('oracledb');

// Oracle Instant Client 경로 설정
oracledb.initOracleClient({ libDir: '/opt/oracle/instantclient' });  // 앱 시작 직후에 실행


const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const chatbotRouter = require('./routes/chatbot');
const sqlGenRouter = require('./routes/sqlgen');
const configRouter = require('./routes/config');

const app = express();

// Log the initialization of the app
console.log('Initializing Express application');

// view engine setup
console.log('Setting up view engine');
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Middleware setup
console.log('Setting up middleware');
app.use(logger('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 새로운 정적 파일 경로 추가 (PDF 파일 경로)
console.log('Setting up static file directory for uploads');
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Log router initialization
console.log('Initializing routers');
app.use('/', (req, res, next) => {
  next();
}, indexRouter);
app.use('/api/chatbot', (req, res, next) => {
  console.log('Chatbot router');
  next();
}, chatbotRouter); 
app.use('/api/sqlgen', (req, res, next) => {
  console.log('SQL Generation router');
  next();
}, sqlGenRouter); 
app.use('/api/config', (req, res, next) => {
  console.log('Config router');
  next();
}, configRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  console.log('404 error handler');
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  console.error('Error handler:', err);
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

console.log('Express application initialized successfully');

module.exports = app;
