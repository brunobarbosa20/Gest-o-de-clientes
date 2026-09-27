-- Importa registro_compras_doces.xlsx para a conta administradora.
-- Mantém os totais históricos da planilha; o catálogo Brigadeiro fica a R$ 12,00.
-- paid_at permanece NULL porque a planilha não informa a data em que o pagamento ocorreu.
-- Chaves estáveis de origem evitam duplicação de compras ao reexecutar.

BEGIN;

CREATE TEMP TABLE import_compras_doces_xlsx (
  source_row integer PRIMARY KEY,
  purchase_date date NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  client_name text NOT NULL,
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
  is_paid boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO import_compras_doces_xlsx
  (source_row, purchase_date, quantity, client_name, total_amount, is_paid)
VALUES
  (2, DATE '2026-06-12', 1, 'Tais', 12.00, TRUE),
  (3, DATE '2026-06-12', 2, 'Eloana', 24.00, TRUE),
  (4, DATE '2026-06-12', 1, 'Amanda', 12.00, TRUE),
  (5, DATE '2026-06-12', 1, 'Angélica', 12.00, TRUE),
  (6, DATE '2026-06-12', 1, 'Stephani', 12.00, TRUE),
  (7, DATE '2026-06-12', 1, 'Raquel', 12.00, TRUE),
  (8, DATE '2026-06-12', 1, 'Laís', 12.00, TRUE),
  (9, DATE '2026-06-12', 2, 'Euzinha', 24.00, FALSE),
  (10, DATE '2026-06-12', 1, 'Gisele', 12.00, TRUE),
  (11, DATE '2026-06-12', 1, 'Janaina', 12.00, TRUE),
  (12, DATE '2026-06-12', 1, 'Patrícia', 12.00, TRUE),
  (13, DATE '2026-06-12', 1, 'Bianca', 12.00, FALSE),
  (14, DATE '2026-06-15', 1, 'Angélica', 12.00, TRUE),
  (15, DATE '2026-06-15', 1, 'Stephani', 12.00, TRUE),
  (16, DATE '2026-06-15', 1, 'Tais', 12.00, TRUE),
  (17, DATE '2026-06-15', 1, 'Vitória', 12.00, TRUE),
  (18, DATE '2026-06-15', 1, 'Juliana', 12.00, TRUE),
  (19, DATE '2026-06-15', 1, 'keren', 12.00, TRUE),
  (20, DATE '2026-06-15', 1, 'Dani', 12.00, TRUE),
  (21, DATE '2026-06-15', 3, 'Janaina', 36.00, TRUE),
  (22, DATE '2026-06-15', 1, 'Naiane', 12.00, TRUE),
  (23, DATE '2026-06-15', 1, 'Patrícia', 12.00, TRUE),
  (24, DATE '2026-06-15', 1, 'Bia', 12.00, FALSE),
  (25, DATE '2026-06-19', 1, 'Keren', 12.00, TRUE),
  (26, DATE '2026-06-19', 1, 'Patrícia', 12.00, TRUE),
  (27, DATE '2026-06-19', 1, 'Angélica', 12.00, TRUE),
  (28, DATE '2026-06-19', 2, 'Eloana', 24.00, TRUE),
  (29, DATE '2026-06-19', 1, 'Amanda', 12.00, TRUE),
  (30, DATE '2026-06-19', 1, 'Claudia', 12.00, TRUE),
  (31, DATE '2026-06-19', 1, 'Angelita', 12.00, TRUE),
  (32, DATE '2026-06-19', 2, 'Bianca', 24.00, FALSE),
  (33, DATE '2026-06-19', 1, 'Dirce', 12.00, FALSE),
  (34, DATE '2026-06-19', 1, 'Laís', 12.00, TRUE),
  (35, DATE '2026-06-24', 2, 'Vitória', 24.00, TRUE),
  (36, DATE '2026-06-24', 2, 'Eloana', 24.00, TRUE),
  (37, DATE '2026-06-24', 2, 'Juliana', 24.00, TRUE),
  (38, DATE '2026-06-24', 1, 'Amanda', 12.00, TRUE),
  (39, DATE '2026-06-24', 1, 'Fernanda', 12.00, TRUE),
  (40, DATE '2026-06-24', 1, 'Angelita', 12.00, TRUE),
  (41, DATE '2026-06-24', 1, 'Dani grávida', 12.00, FALSE),
  (42, DATE '2026-06-24', 1, 'Dani', 12.00, TRUE),
  (43, DATE '2026-06-24', 1, 'Angélica', 12.00, TRUE),
  (44, DATE '2026-06-24', 1, 'Naiane', 12.00, TRUE),
  (45, DATE '2026-06-24', 1, 'Keren', 12.00, TRUE),
  (46, DATE '2026-06-26', 2, 'Eloana', 24.00, TRUE),
  (47, DATE '2026-06-26', 2, 'Vitória', 24.00, TRUE),
  (48, DATE '2026-06-26', 1, 'Nayane', 12.00, TRUE),
  (49, DATE '2026-06-26', 2, 'Bianca', 24.00, FALSE),
  (50, DATE '2026-06-26', 2, 'Jessica Tainá', 24.00, TRUE),
  (51, DATE '2026-06-26', 1, 'Patrícia', 12.00, TRUE),
  (52, DATE '2026-06-26', 1, 'Ju', 12.00, TRUE),
  (53, DATE '2026-06-26', 1, 'Laís', 12.00, TRUE),
  (54, DATE '2026-06-26', 1, 'Raquel', 12.00, TRUE),
  (55, DATE '2026-06-26', 1, 'Janaina', 12.00, TRUE),
  (56, DATE '2026-06-26', 1, 'Tais', 12.00, TRUE),
  (57, DATE '2026-06-26', 1, 'Gisele', 12.00, TRUE),
  (58, DATE '2026-06-26', 1, 'João Lucas', 12.00, TRUE),
  (59, DATE '2026-06-26', 1, 'Amanda', 12.00, TRUE),
  (60, DATE '2026-06-26', 1, 'Bia', 6.00, FALSE),
  (61, DATE '2026-06-30', 2, 'Eloana', 24.00, TRUE),
  (62, DATE '2026-06-30', 2, 'Vitória', 24.00, TRUE),
  (63, DATE '2026-06-30', 1, 'Fernanda', 12.00, TRUE),
  (64, DATE '2026-06-30', 2, 'Bia Oliveira', 24.00, TRUE),
  (65, DATE '2026-06-30', 1, 'Claudia', 12.00, TRUE),
  (66, DATE '2026-06-30', 1, 'Dirce', 12.00, FALSE),
  (67, DATE '2026-06-30', 1, 'Stephani', 12.00, TRUE),
  (68, DATE '2026-06-30', 1, 'Bianca', 12.00, FALSE),
  (69, DATE '2026-06-30', 1, 'Patrícia', 12.00, TRUE),
  (70, DATE '2026-06-30', 1, 'Keren', 12.00, TRUE),
  (71, DATE '2026-06-30', 1, 'Dani grávida', 12.00, FALSE),
  (72, DATE '2026-06-30', 1, 'Dani', 12.00, TRUE),
  (73, DATE '2026-06-30', 1, 'Nayane', 12.00, TRUE),
  (74, DATE '2026-06-30', 1, 'Vanessa Pietro', 12.00, TRUE),
  (75, DATE '2026-06-30', 1, 'Tais', 12.00, TRUE),
  (76, DATE '2026-07-06', 1, 'Angélica', 12.00, TRUE),
  (77, DATE '2026-07-06', 1, 'Stephani', 12.00, TRUE),
  (78, DATE '2026-07-06', 1, 'Jessica Thaina', 12.00, TRUE),
  (79, DATE '2026-07-06', 1, 'Vitória', 12.00, TRUE),
  (80, DATE '2026-07-06', 1, 'Amanda', 12.00, TRUE),
  (81, DATE '2026-07-06', 2, 'Bianca', 24.00, FALSE),
  (82, DATE '2026-07-06', 1, 'Bruno', 12.00, TRUE),
  (83, DATE '2026-07-14', 2, 'Raquel', 24.00, TRUE),
  (84, DATE '2026-07-14', 6, 'Vitória', 72.00, TRUE),
  (85, DATE '2026-07-14', 1, 'Patrícia', 12.00, FALSE),
  (86, DATE '2026-07-14', 1, 'Bianca', 12.00, FALSE),
  (87, DATE '2026-07-14', 1, 'Tais', 12.00, TRUE),
  (88, DATE '2026-07-14', 1, 'Angelita', 12.00, TRUE),
  (89, DATE '2026-07-14', 1, 'Dani grávida', 12.00, FALSE),
  (90, DATE '2026-07-14', 1, 'Laís', 12.00, TRUE),
  (91, DATE '2026-07-14', 2, 'Janaina gêmeos', 24.00, FALSE),
  (92, DATE '2026-07-14', 1, 'Fernanda', 12.00, TRUE),
  (93, DATE '2026-07-14', 1, 'Moça blistadeira', 12.00, TRUE),
  (94, DATE '2026-07-14', 2, 'Eloana', 24.00, TRUE),
  (95, DATE '2026-07-21', 2, 'Eloana', 24.00, TRUE),
  (96, DATE '2026-07-21', 2, 'Juliana', 24.00, TRUE),
  (97, DATE '2026-07-21', 2, 'Adrielle', 24.00, TRUE),
  (98, DATE '2026-07-21', 2, 'Amanda', 24.00, TRUE),
  (99, DATE '2026-07-21', 2, 'Gisele', 24.00, TRUE),
  (100, DATE '2026-07-21', 1, 'Patrícia', 12.00, FALSE),
  (101, DATE '2026-07-21', 1, 'Duda', 12.00, TRUE),
  (102, DATE '2026-07-21', 2, 'Jucilene', 24.00, TRUE),
  (103, DATE '2026-07-21', 1, 'Mara', 12.00, TRUE),
  (104, DATE '2026-07-21', 1, 'Tais', 12.00, TRUE),
  (105, DATE '2026-07-21', 1, 'Tairine', 12.00, TRUE),
  (106, DATE '2026-07-21', 1, 'Andreia blistadeira', 12.00, TRUE),
  (107, DATE '2026-07-21', 2, 'Bruno', 24.00, TRUE),
  (108, DATE '2026-07-21', 1, 'Bia', 12.00, FALSE),
  (109, DATE '2026-07-27', 2, 'Eloana', 24.00, TRUE),
  (110, DATE '2026-07-27', 1, 'Andreia blistadeira', 12.00, TRUE),
  (111, DATE '2026-07-27', 1, 'Claudia manhã', 12.00, TRUE),
  (112, DATE '2026-07-27', 1, 'Angelita', 12.00, TRUE),
  (113, DATE '2026-07-27', 1, 'Amanda', 12.00, TRUE),
  (114, DATE '2026-07-27', 2, 'Adrielle', 24.00, TRUE),
  (115, DATE '2026-07-27', 1, 'Nayane', 12.00, TRUE),
  (116, DATE '2026-07-27', 1, 'Bia', 12.00, FALSE),
  (117, DATE '2026-08-06', 1, 'Dani', 12.00, TRUE),
  (118, DATE '2026-08-06', 1, 'Naiane', 12.00, TRUE),
  (119, DATE '2026-08-06', 2, 'Vitória', 24.00, FALSE),
  (120, DATE '2026-08-06', 1, 'Tais', 12.00, TRUE),
  (121, DATE '2026-08-06', 1, 'Juliana', 12.00, TRUE),
  (122, DATE '2026-08-06', 1, 'Eloana', 1.00, TRUE),
  (123, DATE '2026-08-06', 1, 'Michele', 12.00, TRUE),
  (124, DATE '2026-08-06', 1, 'Andréia Blistadeira', 12.00, TRUE),
  (125, DATE '2026-08-06', 1, 'Claudia Lu', 12.00, TRUE),
  (126, DATE '2026-08-06', 1, 'Claudia avanzi', 12.00, TRUE),
  (127, DATE '2026-08-06', 1, 'Fernanda', 12.00, TRUE),
  (128, DATE '2026-08-06', 1, 'Juliana qualidade', 12.00, TRUE),
  (129, DATE '2026-08-06', 1, 'Angelita', 12.00, TRUE),
  (130, DATE '2026-08-13', 2, 'Joyce', 24.00, TRUE),
  (131, DATE '2026-08-13', 2, 'Vitória', 24.00, TRUE),
  (132, DATE '2026-08-13', 1, 'Juliana qualidade', 12.00, TRUE),
  (133, DATE '2026-08-13', 1, 'Amanda', 12.00, TRUE),
  (134, DATE '2026-08-13', 1, 'Janaina gêmeos', 12.00, FALSE),
  (135, DATE '2026-08-13', 1, 'Michele', 12.00, TRUE),
  (136, DATE '2026-08-13', 1, 'Dani', 12.00, TRUE),
  (137, DATE '2026-08-13', 2, 'Mirinha', 24.00, TRUE),
  (138, DATE '2026-08-18', 2, 'Vitória', 24.00, TRUE),
  (139, DATE '2026-08-18', 1, 'Fernanda', 12.00, TRUE),
  (140, DATE '2026-08-18', 1, 'Edna', 12.00, TRUE),
  (141, DATE '2026-08-18', 1, 'Dani', 12.00, TRUE),
  (142, DATE '2026-08-18', 1, 'Amanda', 12.00, TRUE),
  (143, DATE '2026-08-18', 1, 'Angelita', 12.00, TRUE),
  (144, DATE '2026-08-18', 1, 'Aninha', 12.00, TRUE),
  (145, DATE '2026-08-18', 1, 'Mayara', 12.00, TRUE),
  (146, DATE '2026-08-18', 1, 'Lais', 12.00, TRUE),
  (147, DATE '2026-08-18', 1, 'Patrícia', 12.00, FALSE),
  (148, DATE '2026-08-18', 2, 'Eloana', 24.00, TRUE),
  (149, DATE '2026-08-18', 1, 'Keren', 12.00, TRUE),
  (150, DATE '2026-08-18', 1, 'Naiane', 12.00, TRUE),
  (151, DATE '2026-08-19', 1, 'Tais', 12.00, TRUE),
  (152, DATE '2026-08-19', 1, 'Angelita', 12.00, TRUE),
  (153, DATE '2026-08-19', 1, 'Michele', 12.00, TRUE),
  (154, DATE '2026-08-19', 1, 'Jessica', 12.00, TRUE),
  (155, DATE '2026-08-19', 1, 'Joyce', 12.00, TRUE),
  (156, DATE '2026-08-19', 1, 'Stephani', 12.00, TRUE),
  (157, DATE '2026-08-19', 1, 'Amanda', 12.00, TRUE),
  (158, DATE '2026-08-19', 1, 'Angélica', 12.00, TRUE),
  (159, DATE '2026-08-19', 1, 'Laís', 12.00, TRUE),
  (160, DATE '2026-08-19', 1, 'Patrícia', 12.00, FALSE),
  (161, DATE '2026-08-20', 1, 'Amanda', 12.00, TRUE),
  (162, DATE '2026-08-20', 2, 'Vitória', 24.00, TRUE),
  (163, DATE '2026-08-20', 1, 'Juliana qualidade', 12.00, TRUE),
  (164, DATE '2026-08-20', 1, 'Patrícia', 12.00, FALSE),
  (165, DATE '2026-08-20', 1, 'Laís', 12.00, TRUE),
  (166, DATE '2026-08-20', 1, 'Fernanda', 12.00, TRUE),
  (167, DATE '2026-08-20', 2, 'Eloana', 24.00, TRUE),
  (168, DATE '2026-08-20', 1, 'Juliana Fascina', 12.00, FALSE),
  (169, DATE '2026-08-20', 1, 'Carla', 12.00, TRUE),
  (170, DATE '2026-08-21', 1, 'Naiane', 12.00, TRUE),
  (171, DATE '2026-08-21', 2, 'Amanda', 24.00, FALSE),
  (172, DATE '2026-08-21', 1, 'Keren', 12.00, TRUE),
  (173, DATE '2026-08-21', 1, 'Angélica', 12.00, TRUE),
  (174, DATE '2026-08-21', 1, 'Stephani', 12.00, TRUE),
  (175, DATE '2026-08-21', 1, 'Alana', 12.00, TRUE),
  (176, DATE '2026-08-21', 1, 'Laís', 12.00, TRUE),
  (177, DATE '2026-08-21', 1, 'Michele', 12.00, TRUE),
  (178, DATE '2026-08-21', 1, 'Dani', 12.00, TRUE),
  (179, DATE '2026-08-21', 2, 'Eloana', 24.00, TRUE),
  (180, DATE '2026-08-21', 1, 'Ju fascina', 12.00, FALSE),
  (181, DATE '2026-08-25', 1, 'Amanda', 12.00, FALSE),
  (182, DATE '2026-08-25', 1, 'Angelita', 12.00, TRUE),
  (183, DATE '2026-08-25', 2, 'Adrielle', 24.00, TRUE),
  (184, DATE '2026-08-25', 1, 'Edna', 12.00, TRUE),
  (185, DATE '2026-08-25', 1, 'Michele', 12.00, TRUE),
  (186, DATE '2026-08-25', 1, 'Juliana qualidade', 12.00, TRUE),
  (187, DATE '2026-08-25', 2, 'Juliana Fascina', 12.00, FALSE),
  (188, DATE '2026-08-25', 2, 'Fernanda', 24.00, TRUE),
  (189, DATE '2026-08-25', 1, 'Andreia', 12.00, TRUE),
  (190, DATE '2026-08-25', 1, 'João Lucas', 12.00, TRUE),
  (191, DATE '2026-08-26', 1, 'Michele', 12.00, FALSE),
  (192, DATE '2026-08-26', 1, 'Bia', 12.00, FALSE),
  (193, DATE '2026-08-27', 1, 'Vitória', 12.00, FALSE),
  (194, DATE '2026-08-27', 1, 'Amanda', 12.00, FALSE),
  (195, DATE '2026-08-27', 1, 'Naiane', 12.00, TRUE),
  (196, DATE '2026-08-27', 1, 'Juliana Fascina', 12.00, FALSE),
  (197, DATE '2026-08-27', 1, 'Fernanda', 12.00, TRUE),
  (198, DATE '2026-08-27', 1, 'Eloana', 12.00, TRUE),
  (199, DATE '2026-08-27', 1, 'Andreia', 12.00, TRUE),
  (200, DATE '2026-08-27', 1, 'Talita', 12.00, TRUE),
  (201, DATE '2026-08-28', 1, 'Naiane', 12.00, TRUE),
  (202, DATE '2026-08-28', 1, 'Geovana Dani', 12.00, TRUE),
  (203, DATE '2026-08-28', 2, 'Talita', 24.00, TRUE),
  (204, DATE '2026-08-28', 1, 'Joice', 12.00, TRUE),
  (205, DATE '2026-08-28', 2, 'Adrielle', 24.00, TRUE),
  (206, DATE '2026-08-28', 1, 'Amanda', 8.50, FALSE),
  (207, DATE '2026-08-28', 1, 'Jessica A', 12.00, TRUE),
  (208, DATE '2026-08-28', 2, 'Janaina gêmeos', 24.00, FALSE),
  (209, DATE '2026-08-28', 1, 'Angélica', 12.00, TRUE),
  (210, DATE '2026-08-28', 1, 'Patrícia', 12.00, FALSE),
  (211, DATE '2026-08-28', 1, 'Stephani', 12.00, TRUE),
  (212, DATE '2026-08-28', 4, 'Juliana Fascina', 48.00, FALSE),
  (213, DATE '2026-08-28', 1, 'Keren', 12.00, TRUE),
  (214, DATE '2026-08-28', 1, 'Laís', 12.00, TRUE),
  (215, DATE '2026-08-28', 2, 'Vitória', 24.00, TRUE),
  (216, DATE '2026-09-02', 2, 'Vitória', 20.00, TRUE),
  (217, DATE '2026-09-02', 1, 'Adrielle', 12.00, TRUE),
  (218, DATE '2026-09-02', 2, 'Amanda', 24.00, TRUE),
  (219, DATE '2026-09-02', 1, 'Edna', 12.00, TRUE),
  (220, DATE '2026-09-02', 1, 'Angelita', 12.00, TRUE),
  (221, DATE '2026-09-02', 1, 'Patrícia', 12.00, FALSE),
  (222, DATE '2026-09-02', 1, 'Júlia academia', 12.00, TRUE),
  (223, DATE '2026-09-02', 2, 'Gisele', 24.00, FALSE),
  (224, DATE '2026-09-02', 2, 'Mirinha', 24.00, TRUE),
  (225, DATE '2026-09-02', 1, 'Jessica expedição', 12.00, TRUE),
  (226, DATE '2026-09-03', 2, 'Vitinho frango', 24.00, FALSE),
  (227, DATE '2026-09-04', 1, 'Vitória', 12.00, TRUE),
  (228, DATE '2026-09-04', 2, 'Michele compressora', 24.00, FALSE),
  (229, DATE '2026-09-04', 2, 'Eloana', 24.00, TRUE),
  (230, DATE '2026-09-04', 1, 'Raquel', 12.00, FALSE),
  (231, DATE '2026-09-04', 2, 'Eslene', 24.00, FALSE),
  (232, DATE '2026-09-04', 1, 'Vitinho academia', 12.00, FALSE),
  (233, DATE '2026-09-04', 1, 'Júlia academia', 12.00, TRUE),
  (234, DATE '2026-09-09', 4, 'Fernanda', 48.00, FALSE),
  (235, DATE '2026-09-09', 1, 'Bia', 12.00, FALSE),
  (236, DATE '2026-09-09', 6, 'Eloana', 72.00, TRUE),
  (237, DATE '2026-09-09', 1, 'Dani', 12.00, FALSE),
  (238, DATE '2026-09-09', 1, 'Giovana Dani', 12.00, TRUE),
  (239, DATE '2026-09-09', 1, 'Amanda', 12.00, TRUE),
  (240, DATE '2026-09-09', 1, 'Vitória', 12.00, FALSE),
  (241, DATE '2026-09-09', 1, 'Laís', 12.00, FALSE),
  (242, DATE '2026-09-09', 2, 'Andreia blistadeira', 24.00, TRUE),
  (243, DATE '2026-09-09', 1, 'Talita', 12.00, TRUE),
  (244, DATE '2026-09-10', 2, 'Vitória', 24.00, FALSE),
  (245, DATE '2026-09-10', 1, 'Raquel', 12.00, FALSE),
  (246, DATE '2026-09-10', 1, 'Adrielle', 12.00, TRUE),
  (247, DATE '2026-09-10', 1, 'Michele', 12.00, TRUE),
  (248, DATE '2026-09-10', 1, 'Laís', 12.00, FALSE),
  (249, DATE '2026-09-10', 1, 'Edna', 12.00, FALSE),
  (250, DATE '2026-09-10', 1, 'Eslene', 12.00, TRUE),
  (251, DATE '2026-09-10', 1, 'Bia', 12.00, FALSE),
  (252, DATE '2026-09-15', 1, 'Vitória', 12.00, TRUE),
  (253, DATE '2026-09-15', 1, 'Adrielle', 12.00, TRUE),
  (254, DATE '2026-09-15', 1, 'Eslene', 12.00, TRUE),
  (255, DATE '2026-09-15', 1, 'Laís', 12.00, FALSE),
  (256, DATE '2026-09-15', 4, 'João Lucas', 48.00, TRUE),
  (257, DATE '2026-09-15', 2, 'Jessica', 24.00, TRUE),
  (258, DATE '2026-09-15', 2, 'Vanessa', 24.00, TRUE),
  (259, DATE '2026-09-15', 1, 'Aninha', 12.00, TRUE),
  (260, DATE '2026-09-16', 1, 'Vitória', 12.00, FALSE),
  (261, DATE '2026-09-16', 1, 'Amanda', 7.00, TRUE),
  (262, DATE '2026-09-16', 1, 'Carla', 12.00, TRUE),
  (263, DATE '2026-09-16', 1, 'Juliana Qualidade', 12.00, TRUE),
  (264, DATE '2026-09-16', 2, 'Jessica Almeida', 24.00, TRUE),
  (265, DATE '2026-09-16', 1, 'Janaina gêmeos', 12.00, FALSE),
  (266, DATE '2026-09-16', 1, 'Sueli', 12.00, FALSE),
  (267, DATE '2026-09-16', 1, 'Jessica Thaina', 12.00, FALSE),
  (268, DATE '2026-09-16', 1, 'Gisele', 12.00, FALSE),
  (269, DATE '2026-09-16', 2, 'Bia', 24.00, FALSE),
  (270, DATE '2026-09-19', 3, 'Laís', 36.00, FALSE),
  (271, DATE '2026-09-19', 1, 'Amanda', 12.00, FALSE),
  (272, DATE '2026-09-19', 1, 'Simone', 12.00, TRUE),
  (273, DATE '2026-09-19', 1, 'Vitória', 12.00, FALSE),
  (274, DATE '2026-09-21', 2, 'Eloana', 24.00, FALSE),
  (275, DATE '2026-09-22', 1, 'Raquel', 12.00, FALSE),
  (276, DATE '2026-09-22', 2, 'Vitória', 24.00, FALSE),
  (277, DATE '2026-09-22', 1, 'Amanda', 12.00, FALSE),
  (278, DATE '2026-09-22', 1, 'Naiane', 12.00, FALSE),
  (279, DATE '2026-09-22', 3, 'Eloana', 36.00, FALSE),
  (280, DATE '2026-09-22', 1, 'Bia', 12.00, FALSE),
  (281, DATE '2026-09-22', 2, 'Andreia blistadeira', 24.00, FALSE),
  (282, DATE '2026-09-23', 1, 'Eloana', 12.00, FALSE),
  (283, DATE '2026-09-24', 3, 'Vitória', 36.00, FALSE),
  (284, DATE '2026-09-24', 2, 'Eloana', 24.00, FALSE),
  (285, DATE '2026-09-24', 1, 'Carla', 12.00, FALSE),
  (286, DATE '2026-09-24', 1, 'Islene', 12.00, FALSE),
  (287, DATE '2026-09-24', 1, 'Amanda', 12.00, FALSE),
  (288, DATE '2026-09-24', 1, 'Bia', 12.00, FALSE);

DO $import$
DECLARE
  v_owner_id uuid;
  v_sweet_id uuid;
  v_client_id uuid;
  v_match_count integer;
  v_client record;
  v_purchase record;
BEGIN
  SELECT id INTO v_owner_id
  FROM auth.users
  WHERE lower(email) = lower('beatriz@admin.com');

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Não encontrei a conta beatriz@admin.com em Authentication > Users.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = v_owner_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'A conta beatriz@admin.com não está configurada como administradora.';
  END IF;

  SELECT count(*) INTO v_match_count
  FROM public.sweets
  WHERE owner_id = v_owner_id AND lower(btrim(name)) = lower('Brigadeiro');

  IF v_match_count > 1 THEN
    RAISE EXCEPTION 'Há mais de um doce Brigadeiro no catálogo da conta.';
  ELSIF v_match_count = 1 THEN
    SELECT id INTO v_sweet_id
    FROM public.sweets
    WHERE owner_id = v_owner_id AND lower(btrim(name)) = lower('Brigadeiro')
    LIMIT 1;
    UPDATE public.sweets SET price = 12.00 WHERE id = v_sweet_id;
  ELSE
    INSERT INTO public.sweets (owner_id, name, price)
    VALUES (v_owner_id, 'Brigadeiro', 12.00)
    RETURNING id INTO v_sweet_id;
  END IF;

  FOR v_client IN
    SELECT DISTINCT client_name FROM import_compras_doces_xlsx ORDER BY client_name
  LOOP
    SELECT count(*) INTO v_match_count
    FROM public.clients
    WHERE owner_id = v_owner_id AND lower(btrim(name)) = lower(btrim(v_client.client_name));

    IF v_match_count > 1 THEN
      RAISE EXCEPTION 'Há mais de um cliente chamado "%" na conta; resolva a duplicidade antes de importar.', v_client.client_name;
    ELSIF v_match_count = 0 THEN
      INSERT INTO public.clients (owner_id, name, phone)
      VALUES (v_owner_id, v_client.client_name, '')
      RETURNING id INTO v_client_id;
    END IF;
  END LOOP;

  FOR v_purchase IN
    SELECT * FROM import_compras_doces_xlsx ORDER BY source_row
  LOOP
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE owner_id = v_owner_id AND lower(btrim(name)) = lower(btrim(v_purchase.client_name))
    LIMIT 1;

    INSERT INTO public.purchases (
      owner_id, legacy_id, client_id, sweet_id, item_name, quantity,
      unit_price, total_amount, amount_paid, purchase_date
    ) VALUES (
      v_owner_id,
      'xlsx-registro-compras-doces-row-' || v_purchase.source_row::text,
      v_client_id,
      v_sweet_id,
      'Brigadeiro',
      v_purchase.quantity,
      round(v_purchase.total_amount / v_purchase.quantity, 2),
      v_purchase.total_amount,
      CASE WHEN v_purchase.is_paid THEN v_purchase.total_amount ELSE 0 END,
      v_purchase.purchase_date
    )
    ON CONFLICT (owner_id, legacy_id) DO NOTHING;
  END LOOP;
END;
$import$;

COMMIT;

SELECT count(*) AS compras_importadas,
       coalesce(sum(quantity), 0) AS unidades,
       coalesce(sum(total_amount), 0) AS valor_total,
       coalesce(sum(amount_paid), 0) AS valor_pago
FROM public.purchases
WHERE owner_id = (SELECT id FROM auth.users WHERE lower(email) = lower('beatriz@admin.com'))
  AND legacy_id LIKE 'xlsx-registro-compras-doces-row-%';
