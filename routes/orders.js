const express = require('express');
const router = express.Router();
router.use(express.json());

//주문하기
router.post('/', (req, res) => {
    res.json('주문 하기');
});

//주문 목록 조회
router.get('/', (req, res) => {
    res.json('주문 목록 조회');
});


//비밀번호 초기화 요청
router.get('/:id',(req, res) => {
    res.json('주문 상세 상품 조회');
});


module.exports = router