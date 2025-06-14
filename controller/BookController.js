const ensureAuthorization = require('../auth');
const jwt = require('jsonwebtoken');
const conn = require('../mariadb');
const { StatusCodes } = require('http-status-codes');

//(카테고리 별, 신간 여부) 전체 도서 목록 조회
const allBooks = (req, res) => {
    let allBooksRes = {};
    let { category_id, news, limit, currentPage } = req.query;
    let offset = limit * (currentPage - 1);

    let sql = `SELECT SQL_CALC_FOUND_ROWS *, (SELECT COUNT(*) FROM likes WHERE liked_book_id = books.id) AS likes FROM books `;
    let values = [];

    if (category_id && news) {
        sql += `WHERE category_id = ? AND pubDate BETWEEN DATE_SUB(NOW(), INTERVAL 1 MONTH) AND NOW()`;
        values = [category_id];
    } else if (category_id) {
        sql += `WHERE category_id = ?`;
        values = [category_id];
    } else if (news) {
        sql += `WHERE pubDate BETWEEN DATE_SUB(NOW(), INTERVAL 1 MONTH) AND NOW()`;
    }

    sql += `LIMIT ? OFFSET ? `;
    values.push(parseInt(limit), offset);

    conn.query(sql, values, (err, results) => {
        if (err) {
            console.log(err);
            return res.status(StatusCodes.BAD_REQUEST).end();
        }

        if (!results.length) {
            return res.status(StatusCodes.NOT_FOUND).end();
        }

        allBooksRes.books = results;

        conn.query(`SELECT found_rows()`, (err, countResults) => {
            if (err) {
                console.log(err);
                return res.status(StatusCodes.BAD_REQUEST).end();
            }

            let pagination = {
                currentPage: parseInt(currentPage),
                totalCount: countResults[0]["found_rows()"],
            };

            allBooksRes.pagination = pagination;
            return res.status(StatusCodes.OK).json(allBooksRes);
        });
    });
};


const bookDetail = (req, res) => {
  const book_id = parseInt(req.params.id);
  if (isNaN(book_id)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "올바르지 않은 book_id입니다.",
    });
  }

  const authorization = ensureAuthorization(req, res);

  if (!authorization) {
    // 로그인 X
    const sql = `SELECT *, 
                        (SELECT COUNT(*) FROM likes WHERE liked_book_id = books.id) AS likes 
                   FROM books 
             LEFT JOIN category 
                     ON books.category_id = category.category_id 
                  WHERE books.id = ?`;

    conn.query(sql, [book_id], (err, results) => {
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
  } else if (authorization instanceof jwt.TokenExpiredError) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      message: "로그인 세션이 만료되었습니다. 다시 로그인하세요.",
    });
  } else if (authorization instanceof jwt.JsonWebTokenError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "잘못된 토큰입니다.",
    });
  } else {
    // 로그인 O
    const sql = `SELECT *, 
                        (SELECT COUNT(*) FROM likes WHERE liked_book_id = books.id) AS likes,
                        (SELECT EXISTS (SELECT * FROM likes WHERE user_id = ? AND liked_book_id = ?)) AS liked 
                   FROM books 
             LEFT JOIN category 
                     ON books.category_id = category.category_id 
                  WHERE books.id = ?`;

    const values = [authorization.id, book_id, book_id];

    conn.query(sql, values, (err, results) => {
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