const ensureAuthorization = require("../auth");
const jwt = require("jsonwebtoken");
const mariadb = require("mysql2/promise");
const { StatusCodes } = require("http-status-codes");

const order = async (req, res) => {
  const conn = await mariadb.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "root",
    database: "Bookshop",
    port: 3307,
    dateStrings: true,
  });

  const authorization = ensureAuthorization(req, res);
  if (authorization instanceof jwt.TokenExpiredError) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      message: "로그인 세션이 만료되었습니다. 다시 로그인하세요.",
    });
  } else if (authorization instanceof jwt.JsonWebTokenError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "잘못된 토큰입니다.",
    });
  }

  const { items, delivery } = req.body;

  // 1. cartItems + books 조인해서 전체 정보 가져오기
  const [cartBooks] = await conn.query(
    `SELECT ci.book_id, ci.quantity, b.title, b.price
     FROM cartItems ci
     JOIN books b ON ci.book_id = b.id
     WHERE ci.id IN (?)`,
    [items]
  );

  // 2. 총 수량 / 총 금액 / 대표 상품명 계산
  let totalQuantity = 0;
  let totalPrice = 0;
  let firstBookTitle = "";

  cartBooks.forEach((item, idx) => {
    totalQuantity += item.quantity;
    totalPrice += item.quantity * item.price;
    if (idx === 0) firstBookTitle = item.title;
  });

  // 3. 배송 정보 insert
  let sql = `INSERT INTO delivery (address, receiver, contact) VALUES (?, ?, ?)`;
  let values = [delivery.address, delivery.receiver, delivery.contact];
  const [deliveryResult] = await conn.execute(sql, values);
  const delivery_id = deliveryResult.insertId;

  // 4. 주문 정보 insert
  sql = `INSERT INTO orders (book_title, total_quantity, total_price, user_id, delivery_id)
         VALUES (?, ?, ?, ?, ?)`;
  values = [firstBookTitle, totalQuantity, totalPrice, authorization.id, delivery_id];
  const [orderResult] = await conn.execute(sql, values);
  const order_id = orderResult.insertId;

  // 5. 주문 상세(orderedBook) insert
  sql = `INSERT INTO orderedBook (order_id, book_id, quantity) VALUES ?`;
  const orderedValues = cartBooks.map(item => [order_id, item.book_id, item.quantity]);
  await conn.query(sql, [orderedValues]);

  // 6. 장바구니 비우기
  await deleteCartItems(conn, items);

  return res.status(StatusCodes.OK).json({ message: "주문 완료", order_id });
};

const deleteCartItems = async (conn, items) => {
  let sql = `DELETE FROM cartItems WHERE id IN (?)`;

  let result = await conn.query(sql, [items]);
  return result;
};

const getOrders = async (req, res) => {
  const authorization = ensureAuthorization(req, res);

  if (authorization instanceof jwt.TokenExpiredError) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      message: "로그인 세션이 만료되었습니다. 다시 로그인하세요.",
    });
  } else if (authorization instanceof jwt.JsonWebTokenError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "잘못된 토큰입니다.",
    });
  } else {
    // ✅ JWT에서 userId 추출
    const userId = authorization.id;

    const conn = await mariadb.createConnection({
      host: "127.0.0.1",
      user: "root",
      password: "root",
      database: "Bookshop",
      port: 3307,
      dateStrings: true,
    });

    const sql = `
        SELECT 
          o.id, o.created_at, d.address, d.receiver, d.contact,
          o.book_title, o.total_quantity, o.total_price
        FROM orders o
        JOIN delivery d ON o.delivery_id = d.id 
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC;
      `;

    const [rows, fields] = await conn.query(sql, [userId]);

    return res.status(StatusCodes.OK).json(rows);
  }
};

const getOrderDetail = async (req, res) => {
  let authorization = ensureAuthorization(req, res);

  if (authorization instanceof jwt.TokenExpiredError) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      message: "로그인 세션이 만료되었습니다. 다시 로그인하세요.",
    });
  } else if (authorization instanceof jwt.JsonWebTokenError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "잘못된 토큰입니다.",
    });
  } else {
    const orderId = req.params.id;
    const conn = await mariadb.createConnection({
      host: "127.0.0.1",
      user: "root",
      password: "root",
      database: "Bookshop",
      port: 3307,
      dateStrings: true,
    });

    let sql = `SELECT book_id, title, author, price, quantity
                FROM orderedBook LEFT JOIN books
                ON orderedBook.book_id = books.id
                WHERE order_id = ?`;
    let [rows, fields] = await conn.query(sql, [orderId]);
    return res.status(StatusCodes.OK).json(rows);
  }
};

module.exports = {
  order,
  getOrders,
  getOrderDetail,
};
