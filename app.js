const express = require('express');
const cors = require('cors'); 

const app = express();

//dotenv모듈
const dotenv = require('dotenv');
dotenv.config();

// CORS 설정
app.use(cors({ 
    origin: 'http://localhost:3000',
    credentials: true 
  }));

app.listen(process.env.PORT, ()=>{
    console.log('server is running');
  });


const userRouter = require('./routes/users');
const bookRouter = require('./routes/books');
const likeRouter = require('./routes/likes');
const cartRouter = require('./routes/carts');
const orderRouter = require('./routes/orders');
const categoryRouter = require('./routes/category');

app.use("/users", userRouter);
app.use("/books", bookRouter);
app.use("/likes", likeRouter);
app.use("/carts", cartRouter);
app.use("/orders", orderRouter);
app.use("/category", categoryRouter);