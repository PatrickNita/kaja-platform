CREATE TABLE b2b_locations (
 id serial PRIMARY KEY, name varchar(160) NOT NULL, address varchar(500) NOT NULL,
 contact varchar(160) NOT NULL, phone varchar(40) NOT NULL,
 token_hash varchar(64) NOT NULL UNIQUE, token_cipher text NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version > 0), details_version integer NOT NULL DEFAULT 1,
 created_by integer NOT NULL REFERENCES members(id), updated_by integer NOT NULL REFERENCES members(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE b2b_products (
 id integer PRIMARY KEY, name varchar(160) NOT NULL, flavor varchar(160) NOT NULL,
 grams integer NOT NULL DEFAULT 200 CHECK(grams > 0), price integer NOT NULL DEFAULT 40000 CHECK(price > 0), position integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE b2b_orders (
 id serial PRIMARY KEY, location_id integer NOT NULL REFERENCES b2b_locations(id),
 location_snapshot jsonb NOT NULL, author varchar(160) NOT NULL,
 author_member_id integer REFERENCES members(id), request_key uuid NOT NULL UNIQUE,
 status varchar(20) NOT NULL DEFAULT 'placed' CHECK(status IN ('placed','confirmed','paid')),
 version integer NOT NULL DEFAULT 1 CHECK(version > 0), total integer NOT NULL CHECK(total > 0),
 confirmed_by integer REFERENCES members(id), paid_by integer REFERENCES members(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz, paid_at timestamptz
);
--> statement-breakpoint
CREATE INDEX b2b_orders_location_created ON b2b_orders(location_id,created_at DESC,id DESC);
--> statement-breakpoint
CREATE TABLE b2b_order_items (
 order_id integer NOT NULL REFERENCES b2b_orders(id), product_id integer NOT NULL REFERENCES b2b_products(id),
 name varchar(160) NOT NULL, flavor varchar(160) NOT NULL, grams integer NOT NULL CHECK(grams > 0),
 price integer NOT NULL CHECK(price > 0), quantity integer NOT NULL CHECK(quantity > 0), PRIMARY KEY(order_id,product_id)
);
--> statement-breakpoint
CREATE TABLE b2b_cashback (
 order_id integer PRIMARY KEY REFERENCES b2b_orders(id), location_id integer NOT NULL REFERENCES b2b_locations(id),
 amount integer NOT NULL CHECK(amount > 0), credited_by integer NOT NULL REFERENCES members(id), created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX b2b_cashback_location ON b2b_cashback(location_id);
--> statement-breakpoint
INSERT INTO b2b_products(id,name,flavor,grams,price,position) VALUES
(1,'BRAIN FREEZE','Gheață',200,40000,0),
(2,'C-TRICK','Bomboane Lămâie',200,40000,1),
(3,'CHA VERDE','Ceai Verde',200,40000,2),
(4,'STWY','Căpșună',200,40000,3),
(5,'HER PLEASURE','Aperol',200,40000,4),
(6,'GUAVERA','Guava',200,40000,5),
(7,'LTP','Tartă de lămâie',200,40000,6),
(8,'ALURE','Aloe Vera',200,40000,7),
(9,'2LATE','Ciocolată',200,40000,8),
(10,'BEE ELIXIR','Miere de tei',200,40000,9),
(11,'FUDGE IT','Brownie',200,40000,10),
(12,'LOVE ANDA','Lavandă',200,40000,11),
(13,'1st SIN','Măr Verde',200,40000,12),
(14,'POMPEI','Pomelo',200,40000,13),
(15,'GREEN & HAIRY','Kiwi Smoothie',200,40000,14),
(16,'JAMPRICOT','Apricot Jam',200,40000,15),
(17,'MONDAY MORNING','Cafea',200,40000,16),
(18,'SPOOKY','Dovleac',200,40000,17),
(19,'PEARADISE','Pară',200,40000,18),
(20,'MANSSI','Mango Lassi',200,40000,19),
(21,'CIN&MON','Lapte Scorțișoară',200,40000,20),
(22,'MON BLANC','Iced Wine (Muscat)',200,40000,21),
(23,'FOREST MASTER','Vînăriță (Woodruff)',200,40000,22),
(24,'CHCK','Cheesecake',200,40000,23),
(25,'NILLA','Vanilie',200,40000,24);
