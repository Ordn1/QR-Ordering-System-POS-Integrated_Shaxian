"""The restaurant's real menu: 60 dishes, their codes, prices and photos.

Codes, English names, Chinese names and prices follow the shop's printed menu board.
The board skips F5 and H2, and F2's Chinese name was not legible, so it is left blank.
Calories are not on the board and are left blank rather than estimated.
"""

from decimal import Decimal
from typing import NamedTuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Category, MenuItem

CATEGORIES: tuple[tuple[str, str, str, str], ...] = (
    ("dumplings", "Wontons and Dumplings", "Wonton at Dumplings", "Wonton ug Dumplings"),
    ("noodles", "Noodles", "Pansit", "Pansit"),
    ("stews", "Stewed Soups", "Nilagang Sabaw", "Linat-ang Sabaw"),
    ("fried", "Fried Noodles and Rice", "Pritong Pansit at Kanin", "Pritong Pansit ug Kan-on"),
    ("sets", "Rice Sets", "Rice Meal Set", "Rice Meal Set"),
    ("sharing", "Sharing Plates", "Pang-salo-salong Ulam", "Sud-an nga Pang-grupo"),
    ("buns", "Buns and Breakfast", "Siopao at Almusal", "Siopao ug Pamahaw"),
    ("sides", "Sides and Extras", "Dagdag at Panig", "Dugang ug Uban Pa"),
)


class Dish(NamedTuple):
    code: str
    category: str
    name_en: str
    name_fil: str
    name_bis: str
    name_zh: str | None
    description_en: str
    description_fil: str
    description_bis: str
    price: Decimal
    allergens: str | None = None
    dietary_flags: str | None = None
    model: str | None = None


DISHES: tuple[Dish, ...] = (
    Dish(
        "A1", "dumplings", "Wonton", "Wonton", "Wonton", "扁食",
        "Shaxian's thin-skinned pork wontons in clear broth.",
        "Manipis ang balat na pork wonton sa malinaw na sabaw.",
        "Nipis og panit nga pork wonton sa tin-aw nga sabaw.",
        Decimal("120.00"), "wheat, egg", None, "wonton",
    ),
    Dish(
        "A2", "noodles", "Peanut Butter Noodles", "Pansit na may Mani", "Pansit nga may Mani",
        "拌面",
        "Shaxian's signature dry noodles tossed in peanut sauce.",
        "Espesyal na pansit ng Shaxian na hinaluan ng sarsa ng mani.",
        "Espesyal nga pansit sa Shaxian nga gisagolan og sarsa sa mani.",
        Decimal("80.00"), "wheat, peanut, soy", None, "peanut-butter-noodles",
    ),
    Dish(
        "A3", "dumplings", "Mini Siopao", "Mini Siopao", "Mini Siopao", "小笼包",
        "Small steamed soup buns filled with seasoned pork.",
        "Maliliit na siopao na may sabaw at timpladong baboy.",
        "Gagmay nga siopao nga naay sabaw ug timpladong baboy.",
        Decimal("130.00"), "wheat, soy", None, "xiaolongbao",
    ),
    Dish(
        "A3s", "dumplings", "Steamed Dumpling", "Pinasingawang Dumpling", "Gi-steam nga Dumpling",
        "蒸饺",
        "Pork dumplings steamed and served in the steamer.",
        "Pork dumplings na pinasingawan at inihain sa steamer.",
        "Pork dumplings nga gi-steam ug giserbe sa steamer.",
        Decimal("130.00"), "wheat",
    ),
    Dish(
        "A4", "dumplings", "Dumplings", "Dumplings", "Dumplings", "水饺",
        "Boiled pork dumplings with a chili-soy dipping sauce.",
        "Nilagang pork dumplings na may sawsawang sili at toyo.",
        "Linat-ang pork dumplings nga naay sawsawan nga sili ug toyo.",
        Decimal("180.00"), "wheat, soy", None, "boiled-dumplings",
    ),
    Dish(
        "A5", "dumplings", "Skinless Wonton", "Wonton na Walang Balat", "Wonton nga Walay Panit",
        "无皮扁食",
        "Seasoned pork balls poached in clear broth, no wrapper.",
        "Timpladong bola-bola ng baboy sa malinaw na sabaw, walang balat.",
        "Timpladong bola-bola sa baboy sa tin-aw nga sabaw, walay panit.",
        Decimal("150.00"), None, None, "skinless-wonton",
    ),
    Dish(
        "A6", "noodles", "Pork Leg Noodles Soup", "Sabaw na Pata at Pansit",
        "Sabaw nga Pata ug Pansit", "猪脚面",
        "Braised pork leg over noodles in pork broth with bok choy.",
        "Nilagang pata ng baboy sa ibabaw ng pansit at sabaw, may pechay.",
        "Linat-ang pata sa baboy ibabaw sa pansit ug sabaw, naay pechay.",
        Decimal("180.00"), "wheat, soy", None, "pork-feet-noodle-soup",
    ),
    Dish(
        "A7", "noodles", "Spicy Beef Noodles Soup", "Maanghang na Sabaw na Baka at Pansit",
        "Halang nga Sabaw nga Baka ug Pansit", "红油牛肉面",
        "Beef over noodles in red chili-oil broth with bok choy.",
        "Baka sa ibabaw ng pansit sa maanghang na sabaw na may chili oil.",
        "Baka ibabaw sa pansit sa halang nga sabaw nga naay chili oil.",
        Decimal("180.00"), "wheat, soy", "spicy",
    ),
    Dish(
        "A8", "noodles", "Spicy Intestine Noodles Soup", "Maanghang na Sabaw na Bituka at Pansit",
        "Halang nga Sabaw nga Tinai ug Pansit", "红油肥肠面",
        "Braised pork intestine over noodles in red chili-oil broth.",
        "Nilagang bituka ng baboy sa pansit at maanghang na sabaw.",
        "Linat-ang tinai sa baboy sa pansit ug halang nga sabaw.",
        Decimal("180.00"), "wheat, soy", "spicy",
    ),
    Dish(
        "A9", "noodles", "Beef Crystal Noodles Soup", "Sabaw na Baka at Sotanghon",
        "Sabaw nga Baka ug Sotanghon", "牛腩酸辣粉",
        "Beef brisket over glass noodles in hot and sour broth.",
        "Pecho ng baka sa sotanghon na may maasim-anghang na sabaw.",
        "Pecho sa baka sa sotanghon nga naay aslom-halang nga sabaw.",
        Decimal("180.00"), "soy", "spicy",
    ),
    Dish(
        "B1", "noodles", "Wonton Noodles Soup", "Sabaw na Wonton at Pansit",
        "Sabaw nga Wonton ug Pansit", "馄饨面",
        "Pork wontons and noodles in clear broth with bok choy.",
        "Wonton at pansit sa malinaw na sabaw na may pechay.",
        "Wonton ug pansit sa tin-aw nga sabaw nga naay pechay.",
        Decimal("180.00"), "wheat, egg", None, "wonton-noodle-soup",
    ),
    Dish(
        "B2", "noodles", "Sauerkraut Pork Noodle Soup", "Sabaw na Baboy at Atsara",
        "Sabaw nga Baboy ug Atsara", "酸菜肉丝面",
        "Shredded pork and pickled mustard greens over noodles.",
        "Hinimay na baboy at atsarang mustasa sa ibabaw ng pansit.",
        "Gikunis nga baboy ug atsara nga mustasa ibabaw sa pansit.",
        Decimal("180.00"), "wheat, soy", None, "shuangcai-noodle-soup",
    ),
    Dish(
        "B3", "noodles", "Beef Noodles Soup", "Sabaw na Baka at Pansit", "Sabaw nga Baka ug Pansit",
        "红烧牛腩面",
        "Red-braised beef brisket over noodles with bok choy.",
        "Nilagang pecho ng baka sa ibabaw ng pansit, may pechay.",
        "Linat-ang pecho sa baka ibabaw sa pansit, naay pechay.",
        Decimal("180.00"), "wheat, soy",
    ),
    Dish(
        "B4", "noodles", "Intestine Noodles Soup", "Sabaw na Bituka at Pansit",
        "Sabaw nga Tinai ug Pansit", "红烧肥肠面",
        "Red-braised pork intestine over noodles in rich broth.",
        "Nilagang bituka ng baboy sa ibabaw ng pansit at malinamnam na sabaw.",
        "Linat-ang tinai sa baboy ibabaw sa pansit ug lamian nga sabaw.",
        Decimal("180.00"), "wheat, soy", None, "intestine-noodle-soup",
    ),
    Dish(
        "B5", "noodles", "Intestine Crystals Noodles Soup", "Sabaw na Bituka at Sotanghon",
        "Sabaw nga Tinai ug Sotanghon", "肥肠酸辣粉",
        "Pork intestine over glass noodles in hot and sour broth.",
        "Bituka ng baboy sa sotanghon na may maasim-anghang na sabaw.",
        "Tinai sa baboy sa sotanghon nga naay aslom-halang nga sabaw.",
        Decimal("180.00"), "soy", "spicy",
    ),
    Dish(
        "B6", "dumplings", "Fried Wonton", "Pritong Wonton", "Pritong Wonton", "香炸扁食",
        "Crisp-fried pork wontons with sweet chili dip.",
        "Malutong na pritong wonton na may sawsawang matamis na sili.",
        "Kagumkom nga pritong wonton nga naay sawsawan nga tam-is nga sili.",
        Decimal("140.00"), "wheat, egg", None, "fried-wonton",
    ),
    Dish(
        "B7", "dumplings", "Fried Dumplings", "Pritong Dumplings", "Pritong Dumplings", "香炸水饺",
        "Pork dumplings deep-fried until golden, with chili dip.",
        "Pork dumplings na pinirito hanggang ginintuan, may sawsawang sili.",
        "Pork dumplings nga gipiprito hangtod bulawanon, naay sawsawan nga sili.",
        Decimal("140.00"), "wheat, soy",
    ),
    Dish(
        "C1", "stews", "Medicinal Pork Ribs Soup", "Sabaw na Tadyang ng Baboy",
        "Sabaw nga Gusok sa Baboy", "玉米排骨汤",
        "Pork ribs and sweet corn slow-stewed in a clay pot.",
        "Tadyang ng baboy at mais na dahan-dahang niluto sa palayok.",
        "Gusok sa baboy ug mais nga hinay-hinay nga giluto sa kulon.",
        Decimal("120.00"),
    ),
    Dish(
        "C2", "stews", "Chicken Soup", "Sabaw na Manok", "Sabaw nga Manok", "虫草花土鸡汤",
        "Native chicken stewed with cordyceps flower in a clay pot.",
        "Native na manok na niluto kasama ang cordyceps flower sa palayok.",
        "Native nga manok nga giluto uban ang cordyceps flower sa kulon.",
        Decimal("120.00"), None, None, "chicken-soup",
    ),
    Dish(
        "C3", "stews", "Agrocybe Cylindracea Duck Soup", "Sabaw na Pato at Kabute",
        "Sabaw nga Pato ug Uhong", "茶树菇老鸭汤",
        "Duck stewed with tea tree mushrooms in a clay pot.",
        "Pato na niluto kasama ang tea tree mushroom sa palayok.",
        "Pato nga giluto uban ang tea tree mushroom sa kulon.",
        Decimal("120.00"),
    ),
    Dish(
        "C4", "stews", "Dangshen Pig Heart Soup", "Sabaw na Puso ng Baboy",
        "Sabaw nga Kasingkasing sa Baboy", "党参猪心汤",
        "Sliced pig heart stewed with dangshen root and red dates.",
        "Hiniwang puso ng baboy na niluto sa dangshen at pulang datiles.",
        "Hiniwang kasingkasing sa baboy nga giluto sa dangshen ug pula nga datiles.",
        Decimal("120.00"),
    ),
    Dish(
        "D1", "fried", "Fried Noodles", "Pritong Pansit", "Pritong Pansit", "炒泡面",
        "Wok-fried noodles with cabbage, carrot and pork.",
        "Ginisang pansit na may repolyo, karot at baboy.",
        "Gisangag nga pansit nga naay repolyo, karot ug baboy.",
        Decimal("180.00"), "wheat, soy", None, "fried-noodles",
    ),
    Dish(
        "D2", "fried", "Fried Bihon", "Pritong Bihon", "Pritong Bihon", "炒米粉",
        "Thin rice noodles stir-fried with shrimp, pork and vegetables.",
        "Manipis na bihon na ginisa sa hipon, baboy at gulay.",
        "Nipis nga bihon nga gigisa sa pasayan, baboy ug utanon.",
        Decimal("180.00"), "shellfish, soy", None, "fried-bihon",
    ),
    Dish(
        "D2+", "fried", "Fried Bihon Big", "Pritong Bihon (Malaki)", "Pritong Bihon (Dako)",
        "炒河粉",
        "A larger plate of stir-fried rice noodles with shrimp and vegetables.",
        "Mas malaking plato ng ginisang bihon na may hipon at gulay.",
        "Mas dako nga plato sa gigisang bihon nga naay pasayan ug utanon.",
        Decimal("220.00"), "shellfish, soy", None, "fried-bihon",
    ),
    Dish(
        "D3", "fried", "Yangzhou Fried Rice", "Yangzhou Sinangag", "Yangzhou Sinangag", "扬州炒饭",
        "Fried rice with shrimp, ham, egg, peas and carrot.",
        "Sinangag na may hipon, hamon, itlog, gisantes at karot.",
        "Sinangag nga naay pasayan, hamon, itlog, gisantes ug karot.",
        Decimal("180.00"), "shellfish, egg, soy",
    ),
    Dish(
        "D4", "sides", "Tea Eggs", "Itlog sa Tsaa", "Itlog sa Tsaa", "茶叶蛋",
        "Eggs steeped in spiced tea broth. Priced per piece.",
        "Itlog na ibinabad sa mabangong tsaa. Presyo kada piraso.",
        "Itlog nga gibabad sa humot nga tsa. Presyo matag piraso.",
        Decimal("25.00"), "egg", None, "tea-eggs",
    ),
    Dish(
        "D5", "sides", "Sausage", "Inihaw na Sausage", "Sinugba nga Sausage", "烤肉肠",
        "Grilled pork sausage. Priced per piece.",
        "Inihaw na pork sausage. Presyo kada piraso.",
        "Sinugba nga pork sausage. Presyo matag piraso.",
        Decimal("55.00"),
    ),
    Dish(
        "D6", "sides", "Roasted Chicken Leg", "Inihaw na Hita ng Manok", "Sinugba nga Paa sa Manok",
        "烤鸡腿",
        "Roasted chicken leg with chili dip. Priced per piece.",
        "Inihaw na hita ng manok na may sawsawang sili. Presyo kada piraso.",
        "Sinugba nga paa sa manok nga naay sawsawan nga sili. Presyo matag piraso.",
        Decimal("110.00"), "soy",
    ),
    Dish(
        "D7", "sides", "Pickled Chicken Feet", "Atsarang Paa ng Manok", "Atsara nga Tiil sa Manok",
        "泡椒凤爪",
        "Chicken feet in pickled chili brine with lemon.",
        "Paa ng manok na ibinabad sa atsarang sili at lemon.",
        "Tiil sa manok nga gibabad sa atsara nga sili ug lemon.",
        Decimal("200.00"), None, "spicy", "pickled-chicken-feet",
    ),
    Dish(
        "D8", "sides", "Rice", "Kanin", "Kan-on", "白米饭",
        "A bowl of freshly steamed white rice.",
        "Isang mangkok ng bagong saing na puting kanin.",
        "Usa ka panaksan nga bag-ong luto nga puti nga kan-on.",
        Decimal("30.00"), None, "vegetarian", "steamed-rice",
    ),
    Dish(
        "D9", "sides", "Rice (Take out)", "Kanin (Take Out)", "Kan-on (Take Out)", "白米饭(打包)",
        "Steamed white rice packed in a take-out box.",
        "Puting kanin na nakalagay sa take-out na kahon.",
        "Puti nga kan-on nga gisulod sa take-out nga kahon.",
        Decimal("40.00"), None, "vegetarian",
    ),
    Dish(
        "E1", "sets", "Black Pepper Beef with Rice and Soup", "Baka sa Black Pepper na may Kanin",
        "Baka sa Black Pepper nga may Kan-on", "黑椒牛肉套餐",
        "Black pepper beef with rice, bok choy and soup.",
        "Baka sa itim na paminta na may kanin, pechay at sabaw.",
        "Baka sa itom nga paminta nga naay kan-on, pechay ug sabaw.",
        Decimal("210.00"), "soy", None, "black-pepper-beef-set",
    ),
    Dish(
        "E2", "sets", "Preserved Vegetable Braised Pork with Rice and Soup",
        "Meicai na Baboy na may Kanin", "Meicai nga Baboy nga may Kan-on", "梅菜扣肉套餐",
        "Pork belly braised with preserved mustard greens, with rice and soup.",
        "Liempo na nilaga sa preserbadong mustasa, may kanin at sabaw.",
        "Liempo nga linat-an sa preserbadong mustasa, naay kan-on ug sabaw.",
        Decimal("210.00"), "soy", None, "meicai-pork-set",
    ),
    Dish(
        "E3", "sets", "Yuxiang Pork with Rice and Soup", "Yuxiang na Baboy na may Kanin",
        "Yuxiang nga Baboy nga may Kan-on", "鱼香肉丝套餐",
        "Shredded pork in garlic chili sauce, with rice and soup.",
        "Hinimay na baboy sa sarsang bawang at sili, may kanin at sabaw.",
        "Gikunis nga baboy sa sarsa nga ahos ug sili, naay kan-on ug sabaw.",
        Decimal("210.00"), "soy", "spicy",
    ),
    Dish(
        "E4", "sets", "Braised Pork with Rice and Soup", "Nilagang Baboy na may Kanin",
        "Linat-ang Baboy nga may Kan-on", "红烧肉套餐",
        "Red-braised pork belly with rice, bok choy and soup.",
        "Malambot na liempo na may kanin, pechay at sabaw.",
        "Humok nga liempo nga naay kan-on, pechay ug sabaw.",
        Decimal("210.00"), "soy", None, "braised-pork-set",
    ),
    Dish(
        "E5", "sets", "Braised Pork Feet with Rice and Soup", "Nilagang Pata na may Kanin",
        "Linat-ang Pata nga may Kan-on", "红烧猪脚套餐",
        "Red-braised pork trotter with rice, bok choy and soup.",
        "Nilagang pata ng baboy na may kanin, pechay at sabaw.",
        "Linat-ang pata sa baboy nga naay kan-on, pechay ug sabaw.",
        Decimal("210.00"), "soy", None, "braised-pork-feet-set",
    ),
    Dish(
        "E6", "sets", "Braised Beef with Rice and Soup", "Nilagang Baka na may Kanin",
        "Linat-ang Baka nga may Kan-on", "红烧牛腩套餐",
        "Red-braised beef brisket with rice, bok choy and soup.",
        "Nilagang pecho ng baka na may kanin, pechay at sabaw.",
        "Linat-ang pecho sa baka nga naay kan-on, pechay ug sabaw.",
        Decimal("210.00"), "soy", None, "braised-beef-set",
    ),
    Dish(
        "E7", "sets", "Roasted Chicken Leg with Rice and Soup", "Inihaw na Manok na may Kanin",
        "Sinugba nga Manok nga may Kan-on", "烤鸡腿套餐",
        "Roasted chicken leg with rice, bok choy and soup.",
        "Inihaw na hita ng manok na may kanin, pechay at sabaw.",
        "Sinugba nga paa sa manok nga naay kan-on, pechay ug sabaw.",
        Decimal("160.00"), "soy", None, "chicken-leg-set",
    ),
    Dish(
        "F1", "sharing", "Braised Beef", "Nilagang Baka", "Linat-ang Baka", "红烧牛腩",
        "Red-braised beef brisket, a plate for sharing.",
        "Nilagang pecho ng baka, pang-salo-salo.",
        "Linat-ang pecho sa baka, pang-grupo.",
        Decimal("360.00"), "soy",
    ),
    Dish(
        "F2", "sharing", "Braised Intestine", "Nilagang Bituka", "Linat-ang Tinai", None,
        "Red-braised pork intestine with spring onion, for sharing.",
        "Nilagang bituka ng baboy na may dahon ng sibuyas, pang-salo-salo.",
        "Linat-ang tinai sa baboy nga naay dahon sa sibuyas, pang-grupo.",
        Decimal("360.00"), "soy",
    ),
    Dish(
        "F3", "sharing", "Braised Pork Feet", "Nilagang Pata", "Linat-ang Pata", "红烧猪脚",
        "Red-braised pork trotters, a plate for sharing.",
        "Nilagang pata ng baboy, pang-salo-salo.",
        "Linat-ang pata sa baboy, pang-grupo.",
        Decimal("360.00"), "soy", None, "braised-pork-feet",
    ),
    Dish(
        "F4", "sharing", "Braised Beef Shank", "Nilagang Beef Shank", "Linat-ang Beef Shank",
        "卤牛腱子",
        "Sliced soy-braised beef shank with chili oil.",
        "Hiniwang beef shank na nilaga sa toyo, may chili oil.",
        "Hiniwang beef shank nga linat-an sa toyo, naay chili oil.",
        Decimal("360.00"), "soy",
    ),
    Dish(
        "F6", "sharing", "Braised Assortment", "Halo-halong Nilaga", "Sari-saring Linat-an",
        "卤味拼盘",
        "A platter of soy-braised meats, sliced for sharing.",
        "Bandehado ng iba't ibang karneng nilaga sa toyo.",
        "Bandehado sa lain-laing karne nga linat-an sa toyo.",
        Decimal("320.00"), "soy",
    ),
    Dish(
        "F7", "sharing", "Orleans Roasted Chicken", "Orleans na Inihaw na Manok",
        "Orleans nga Sinugba nga Manok", "奥尔良烤鸡",
        "Whole chicken roasted with sweet-savory Orleans spices.",
        "Buong manok na inihaw sa matamis-alat na Orleans na pampalasa.",
        "Tibuok manok nga sinugba sa tam-is-parat nga Orleans nga panakot.",
        Decimal("400.00"),
    ),
    Dish(
        "G1", "sharing", "Black Pepper Beef", "Baka sa Black Pepper", "Baka sa Black Pepper",
        "黑椒牛肉",
        "Beef stir-fried with black pepper, onion and bell pepper.",
        "Baka na ginisa sa itim na paminta, sibuyas at bell pepper.",
        "Baka nga gigisa sa itom nga paminta, sibuyas ug bell pepper.",
        Decimal("320.00"), "soy",
    ),
    Dish(
        "G2", "sharing", "Preserved Vegetable Braised Pork", "Meicai na Baboy", "Meicai nga Baboy",
        "梅菜扣肉",
        "Sliced pork belly braised over preserved mustard greens.",
        "Hiniwang liempo na nilaga sa preserbadong mustasa.",
        "Hiniwang liempo nga linat-an sa preserbadong mustasa.",
        Decimal("320.00"), "soy",
    ),
    Dish(
        "G3", "sharing", "Yuxiang Pork", "Yuxiang na Baboy", "Yuxiang nga Baboy", "鱼香肉丝",
        "Shredded pork with wood ear and carrot in garlic chili sauce.",
        "Hinimay na baboy na may tenga ng daga at karot sa sarsang bawang at sili.",
        "Gikunis nga baboy nga naay dalunggan sa ilaga ug karot sa sarsa nga ahos ug sili.",
        Decimal("320.00"), "soy", "spicy",
    ),
    Dish(
        "G4", "sharing", "Braised Pork", "Nilagang Baboy", "Linat-ang Baboy", "红烧肉",
        "Red-braised pork belly cubes, a plate for sharing.",
        "Nilagang liempo ng baboy, pang-salo-salo.",
        "Linat-ang liempo sa baboy, pang-grupo.",
        Decimal("360.00"), "soy", None, "braised-pork",
    ),
    Dish(
        "G5", "buns", "Fried Buns", "Pritong Mantou", "Pritong Mantou", "炸馒头",
        "Sliced mantou buns fried until golden.",
        "Hiniwang mantou na pinirito hanggang ginintuan.",
        "Hiniwang mantou nga gipiprito hangtod bulawanon.",
        Decimal("50.00"), "wheat",
    ),
    Dish(
        "G6", "buns", "Fried Brown Buns", "Pritong Brown Mantou", "Pritong Brown Mantou", "炸红馒头",
        "Brown sugar mantou sliced and fried until crisp.",
        "Hiniwang brown sugar mantou na pinirito hanggang malutong.",
        "Hiniwang brown sugar mantou nga gipiprito hangtod kagumkom.",
        Decimal("60.00"), "wheat",
    ),
    Dish(
        "G7", "buns", "Matsang", "Matsang", "Matsang", "肉粽",
        "Sticky rice with pork and egg yolk wrapped in bamboo leaves.",
        "Malagkit na bigas na may baboy at pula ng itlog, binalot sa dahon ng kawayan.",
        "Pilit nga bugas nga naay baboy ug tuway sa itlog, giputos sa dahon sa kawayan.",
        Decimal("120.00"), "egg, soy",
    ),
    Dish(
        "G8", "buns", "Soy Milk", "Soy Milk", "Soy Milk", "豆浆",
        "Freshly made soy milk.",
        "Bagong gawang soy milk.",
        "Bag-ong himo nga soy milk.",
        Decimal("40.00"), "soy", "vegetarian",
    ),
    Dish(
        "H1", "buns", "Pork Siopao", "Siopao na Baboy", "Siopao nga Baboy", "酱肉包",
        "Steamed bun filled with savory braised pork.",
        "Siopao na may malinamnam na nilagang baboy.",
        "Siopao nga naay lamian nga linat-ang baboy.",
        Decimal("40.00"), "wheat, soy",
    ),
    Dish(
        "H3", "buns", "Mushroom and Vegetable Siopao", "Siopao na Kabute at Gulay",
        "Siopao nga Uhong ug Utanon", "香菇青菜包",
        "Steamed bun filled with shiitake mushroom and greens.",
        "Siopao na may kabuteng shiitake at gulay.",
        "Siopao nga naay uhong nga shiitake ug utanon.",
        Decimal("40.00"), "wheat", "vegetarian",
    ),
    Dish(
        "H4", "buns", "Mantou", "Mantou", "Mantou", "馒头",
        "Plain steamed wheat bun.",
        "Payak na pinasingawang tinapay.",
        "Yano nga gi-steam nga pan.",
        Decimal("20.00"), "wheat", "vegetarian",
    ),
    Dish(
        "H5", "buns", "Brown Sugar Mantou", "Mantou na may Brown Sugar",
        "Mantou nga may Brown Sugar", "红糖馒头",
        "Steamed bun sweetened with brown sugar.",
        "Pinasingawang tinapay na pinatamis ng brown sugar.",
        "Gi-steam nga pan nga gipatam-is og brown sugar.",
        Decimal("25.00"), "wheat", "vegetarian",
    ),
    Dish(
        "H6", "buns", "Youtiao", "Youtiao", "Youtiao", "油条",
        "Golden fried dough sticks, best with soy milk.",
        "Ginintuang piniritong masa, masarap kasama ang soy milk.",
        "Bulawanon nga pritong masa, lami uban ang soy milk.",
        Decimal("50.00"), "wheat",
    ),
    Dish(
        "H7", "sides", "Fried Pork", "Pritong Baboy", "Pritong Baboy", "炸醋肉",
        "Vinegar-marinated pork strips, battered and fried crisp.",
        "Baboy na ibinabad sa suka, binalot sa harina at piniritong malutong.",
        "Baboy nga gibabad sa suka, gihaplasan og harina ug gipiprito nga kagumkom.",
        Decimal("180.00"), "wheat",
    ),
    Dish(
        "H8", "sides", "Fried Chicken", "Pritong Manok", "Pritong Manok", "炸鸡柳",
        "Battered chicken strips fried until crisp.",
        "Piniritong chicken strips na malutong.",
        "Pritong chicken strips nga kagumkom.",
        Decimal("180.00"), "wheat",
    ),
    Dish(
        "H9", "buns", "Chicken Siopao", "Siopao na Manok", "Siopao nga Manok", "鸡肉包",
        "Steamed bun filled with diced chicken and mushroom.",
        "Siopao na may hiniwang manok at kabute.",
        "Siopao nga naay hiniwang manok ug uhong.",
        Decimal("40.00"), "wheat, soy",
    ),
)

FEATURED: frozenset[str] = frozenset({"A1", "A2", "E4"})

UNAVAILABLE: frozenset[str] = frozenset({"F4"})

HOT: frozenset[str] = frozenset(
    {
        "A1", "A3", "A3s", "A4", "A5", "A6", "A7", "A8", "A9",
        "B1", "B2", "B3", "B4", "B5",
        "C1", "C2", "C3", "C4",
        "D8", "D9",
        "G7",
        "H1", "H3", "H4", "H5", "H9",
    }
)


def image_for(dish: Dish) -> str:
    """Photo filename in frontend/public/menu: the English name in snake_case."""
    stem = "".join(ch if ch.isalnum() else "_" for ch in dish.name_en.lower())
    return "_".join(part for part in stem.split("_") if part) + ".webp"


async def seed_menu(session: AsyncSession) -> dict[str, MenuItem]:
    categories: dict[str, Category] = {}
    for order, (key, name_en, name_fil, name_bis) in enumerate(CATEGORIES, start=1):
        category = Category(
            name_en=name_en,
            name_fil=name_fil,
            name_bis=name_bis,
            display_order=order,
        )
        session.add(category)
        categories[key] = category
    await session.flush()

    items: dict[str, MenuItem] = {}
    for dish in DISHES:
        item = MenuItem(
            cat_id=categories[dish.category].cat_id,
            menu_code=dish.code,
            name_en=dish.name_en,
            name_fil=dish.name_fil,
            name_bis=dish.name_bis,
            name_zh=dish.name_zh,
            description_en=dish.description_en,
            description_fil=dish.description_fil,
            description_bis=dish.description_bis,
            price=dish.price,
            allergens=dish.allergens,
            dietary_flags=dish.dietary_flags,
            image_filename=image_for(dish),
            model_filename=dish.model,
            is_available=dish.code not in UNAVAILABLE,
            is_featured=dish.code in FEATURED,
            is_hot=dish.code in HOT,
        )
        session.add(item)
        items[dish.name_en] = item
    await session.flush()

    return items
