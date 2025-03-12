const express = require('express');
const { 
    allBooks, 
    bookDetail
} = require('../controller/BookController');
const router = express.Router();
router.use(express.json());

router.get('/', allBooks);//(카테고리 별 )전체 도서 조회
router.get('/:id', bookDetail);//개별 도서 조회

module.exports = router