const ensureAuthorization = require('../auth');
const jwt = require('jsonwebtoken');
const conn = require('../mariadb');
const { StatusCodes } = require('http-status-codes');

//(카테고리 별, 신간 여부) 전체 도서 목록 조회
const allBooks = (req, res) => {
    let allBooksRes = {};
    let { categoryId, news, limit, currentPage } = req.query;

    //limit : page 당 도서수                     ex ) 3
    //currentPage : 현재 몇 페이지               ex ) 1, 2, 3 ...
    //offset : limit * (cuurentPage - 1)         ex ) 0, 3, 6, .....

    let offset = limit * (currentPage - 1);

    let sql = `SELECT SQL_CALC_FOUND_ROWS *, (SELECT COUNT(*) FROM likes WHERE liked_book_id = books.id) AS likes FROM books `;
    let values = [];
    if (categoryId && news) {
        sql += `WHERE categoryId = ? AND pubDate BETWEEN DATE_SUB(NOW(), INTERVAL 1 MONTH) AND NOW()`;
        values = [categoryId];
    } else if (categoryId) {
        sql += `WHERE categoryId = ?`;
        values = [categoryId];
    } else if (news) {
        sql += `WHERE pubDate BETWEEN DATE_SUB(NOW(), INTERVAL 1 MONTH) AND NOW()`;
    }

    sql += `LIMIT ? OFFSET ? `;
    values.push(parseInt(limit), offset);

    conn.query(sql, values,
        (err, results) => {
            if (err) {
                console.log(err);
                // return res.status(StatusCodes.BAD_REQUEST).end();
            }
            console.log(results);
            if (results.length) {
                allBooksRes.books = results;
            } else {
                return res.status(StatusCodes.NOT_FOUND).end();
            }
        });

        sql = `SELECT found_rows()`;
        conn.query(sql, values,
            (err, results) => {
                if (err) {
                    console.log(err);
                    return res.status(StatusCodes.BAD_REQUEST).end();
                }

                let pagination = {};
                pagination.currentPage = parseInt(currentPage);
                pagination.totalCount = results[0]["found_rows()"];

                allBooksRes.pagination = pagination;

                return res.status(StatusCodes.OK).json(allBooksRes);
        
            });
}

const bookDetail = (req, res) => {

    //로그인 상태가 아니면 liked 빼고
    //로그인 상태이면 liked 추가 

    let authorization = ensureAuthorization(req, res);

    if (authorization instanceof jwt.TokenExpiredError) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
            "message": "로그인 세션이 만료되었습니다. 다시 로그인하세요."
        });
    } else if (authorization instanceof jwt.JsonWebTokenError) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            "message": "잘못된 토큰입니다."
        });
    } else if (authorization instanceof ReferenceError){
        let book_id = req.params.id;

        let sql = `SELECT * ,
                            (SELECT COUNT(*) FROM likes WHERE liked_book_id = books.id) AS likes
                        FROM books 
                        LEFT JOIN category 
                        ON books.categoryId = category.categoryId
                        WHERE books.id = ?;`;
        let values = [book_id];
        conn.query(sql, values,
            (err, results) => {
                if (err) {
                    console.log(err);
                    return res.status(StatusCodes.BAD_REQUEST).end();
                }
                if (results[0]) {
                    return res.status(StatusCodes.OK).json(results[0]);
                } else {
                    return res.status(StatusCodes.NOT_FOUND).end();
                }
            });
    } else {
        let book_id = req.params.id;

        let sql = `SELECT * ,
                            (SELECT COUNT(*) FROM likes WHERE liked_book_id = books.id) AS likes,
                            (SELECT EXISTS (SELECT * FROM likes WHERE user_id = ? AND liked_book_id = ?)) AS liked
                        FROM books 
                        LEFT JOIN category 
                        ON books.categoryId = category.categoryId
                        WHERE books.id = ?;`;
        let values = [authorization.id, book_id, book_id];

        conn.query(sql, values,
            (err, results) => {
                if (err) {
                    console.log(err);
                    return res.status(StatusCodes.BAD_REQUEST).end();
                }
                if (results[0]) {
                    return res.status(StatusCodes.OK).json(results[0]);
                } else {
                    return res.status(StatusCodes.NOT_FOUND).end();
                }

            });
    }
};

module.exports = {
    allBooks,
    bookDetail
};