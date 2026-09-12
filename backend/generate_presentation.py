"""Скрипт автоматической генерации презентации по Спецификации требований Flow Translate."""

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

# 1. Инициализация презентации (16:9 widescreen)
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# Цветовая палитра в стиле Flow Translate (Warm Minimalist Sand & Graphite)
COLOR_BG = RGBColor(0xF6, 0xF3, 0xED)          # Теплый песочный фон
COLOR_CARD = RGBColor(0xFF, 0xFF, 0xFF)        # Белая плашка
COLOR_TEXT_MAIN = RGBColor(0x1C, 0x1A, 0x17)   # Глубокий графит
COLOR_TEXT_MUTED = RGBColor(0x73, 0x6E, 0x66)  # Приглушенный подзаголовок
COLOR_ACCENT = RGBColor(0x4F, 0x46, 0xE5)      # Индиго акцент
COLOR_CARD_BORDER = RGBColor(0xDD, 0xD3, 0xC4) # Тонкая рамка

def apply_slide_theme(slide, title_text, category_tag="ТЕМА: СПЕЦИФИКАЦИЯ ТРЕБОВАНИЙ"):
    """Создает единый фирменный фон и заголовок слайда."""
    # Заливка фона
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = COLOR_BG
    bg.line.fill.background()

    # Верхний тег категории
    tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.5), Inches(0.4))
    tf_tag = tag_box.text_frame
    tf_tag.word_wrap = True
    p_tag = tf_tag.paragraphs[0]
    p_tag.text = category_tag.upper()
    p_tag.font.size = Pt(10)
    p_tag.font.bold = True
    p_tag.font.color.rgb = COLOR_ACCENT

    # Основной заголовок слайда
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.5), Inches(0.8))
    tf_title = title_box.text_frame
    tf_title.word_wrap = True
    p_title = tf_title.paragraphs[0]
    p_title.text = title_text
    p_title.font.size = Pt(26)
    p_title.font.bold = True
    p_title.font.color.rgb = COLOR_TEXT_MAIN

def add_content_card(slide, left, top, width, height, title, items):
    """Добавляет аккуратную белую карточку с тезисами."""
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = COLOR_CARD
    card.line.color.rgb = COLOR_CARD_BORDER
    card.line.width = Pt(1)

    tb = slide.shapes.add_textbox(left + Inches(0.3), top + Inches(0.25), width - Inches(0.6), height - Inches(0.5))
    tf = tb.text_frame
    tf.word_wrap = True

    if title:
        p_title = tf.paragraphs[0]
        p_title.text = title
        p_title.font.size = Pt(18)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_TEXT_MAIN
        p_title.space_after = Pt(12)

    for item in items:
        p = tf.add_paragraph()
        p.text = f"•  {item}"
        p.font.size = Pt(13)
        p.font.color.rgb = COLOR_TEXT_MUTED
        p.space_after = Pt(8)


# ==========================================
# СЛАЙД 1: ТИТУЛЬНЫЙ
# ==========================================
slide1 = prs.slides.add_slide(prs.slide_layouts[6])
bg1 = slide1.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
bg1.fill.solid()
bg1.fill.fore_color.rgb = COLOR_BG
bg1.line.fill.background()

t_box = slide1.shapes.add_textbox(Inches(1.5), Inches(1.8), Inches(10.3), Inches(3.0))
tf1 = t_box.text_frame
tf1.word_wrap = True

p_badge = tf1.paragraphs[0]
p_badge.text = "КУРСОВАЯ РАБОТА / ПРЕЗЕНТАЦИЯ К ЗАЩИТЕ"
p_badge.font.size = Pt(12)
p_badge.font.bold = True
p_badge.font.color.rgb = COLOR_ACCENT
p_badge.space_after = Pt(14)

p_h1 = tf1.add_paragraph()
p_h1.text = "Спецификация требований к ПО"
p_h1.font.size = Pt(40)
p_h1.font.bold = True
p_h1.font.color.rgb = COLOR_TEXT_MAIN
p_h1.space_after = Pt(10)

p_sub = tf1.add_paragraph()
p_sub.text = "Теоретические стандарты, классификация и реализация в проекте «Flow Translate»"
p_sub.font.size = Pt(18)
p_sub.font.color.rgb = COLOR_TEXT_MUTED

# Инфо-плашка студента
info_card = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.5), Inches(5.0), Inches(10.3), Inches(1.4))
info_card.fill.solid()
info_card.fill.fore_color.rgb = COLOR_CARD
info_card.line.color.rgb = COLOR_CARD_BORDER
info_card.line.width = Pt(1)

info_tb = slide1.shapes.add_textbox(Inches(1.8), Inches(5.15), Inches(9.7), Inches(1.1))
tf_info = info_tb.text_frame
p1 = tf_info.paragraphs[0]
p1.text = "Выполнил: Студент [ФИО]"
p1.font.size = Pt(14)
p1.font.bold = True
p1.font.color.rgb = COLOR_TEXT_MAIN

p2 = tf_info.add_paragraph()
p2.text = "Учебная группа: [Номер группы]  |  Направление: Информационные системы и технологии  |  2026 г."
p2.font.size = Pt(12)
p2.font.color.rgb = COLOR_TEXT_MUTED


# ==========================================
# СЛАЙД 2: ПРОГРАММА ДОКЛАДА
# ==========================================
slide2 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide2, "Содержание и ключевые вопросы исследования")

questions = [
    "Вопрос 1: Определение и роль спецификации требований в программной инженерии",
    "Вопрос 2: Уровни требований — бизнес, пользовательские, функциональные и NFR",
    "Вопрос 3: Сравнительный анализ международных стандартов SRS и отечественных ТЗ (ГОСТ)",
    "Вопрос 4: Практический кейс: Спецификация требований веб-сервиса «Flow Translate»",
    "Вопрос 5 (Специальный): Трансформация спецификации требований в приемочные автотесты",
]
add_content_card(slide2, Inches(1.2), Inches(1.8), Inches(10.9), Inches(4.8), "План доклада", questions)


# ==========================================
# СЛАЙД 3: ЧТО ТАКОЕ СПЕЦИФИКАЦИЯ ТРЕБОВАНИЙ
# ==========================================
slide3 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide3, "1. Что такое спецификация требований к ПО?")

items3_1 = [
    "Формальный структурированный документ, описывающий назначение, функционал и рамки разрабатываемого ПО.",
    "Выступает инженерным и юридическим контрактом между заказчиком, аналитиками, разработчиками и QA.",
    "Служит единственным источником истины (Single Source of Truth) при проектировании архитектуры системы.",
]
add_content_card(slide3, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8), "Определение и назначение", items3_1)

items3_2 = [
    "Атомарность: каждое требование описывает ровно одну неделимую функцию.",
    "Однозначность: исключение возможности двоякой интерпретации командой.",
    "Проверяемость (Testability): возможность однозначно подтвердить факт реализации через автотест.",
    "Трассируемость: связь требований с целями бизнеса и сценариями тестирования.",
]
add_content_card(slide3, Inches(6.8), Inches(1.8), Inches(5.6), Inches(4.8), "Критерии качества (ISO/IEC/IEEE 29148)", items3_2)


# ==========================================
# СЛАЙД 4: ТИПЫ И УРОВНИ ТРЕБОВАНИЙ
# ==========================================
slide4 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide4, "2. Иерархия и типология требований к ПО")

items4_1 = [
    "Бизнес-требования: высокоуровневые цели организации и обоснование окупаемости инвестиций (ROI).",
    "Пользовательские требования: сценарии и задачи пользователя (User Stories, Use Cases).",
    "Функциональные требования (FR): точное алгоритмическое поведение системы («вход ➔ обработка ➔ выход»).",
]
add_content_card(slide4, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8), "Бизнес и функциональный уровни", items4_1)

items4_2 = [
    "Производительность (Performance): максимальное время отклика API (< 500 мс).",
    "Безопасность (Security): стойкое хэширование паролей, защита данных, stateless JWT.",
    "Отказоустойчивость (Reliability): глобальная изоляция и корректная обработка сбоев (RFC 7807).",
    "Удобство использования (UX/UI): адаптивность, темы оформления, доступность.",
]
add_content_card(slide4, Inches(6.8), Inches(1.8), Inches(5.6), Inches(4.8), "Нефункциональные требования (NFR)", items4_2)


# ==========================================
# СЛАЙД 5: SRS VS ТЗ: КОНЦЕПЦИИ
# ==========================================
slide5 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide5, "3. Разница между SRS и ТЗ: Концептуальные отличия")

items5_1 = [
    "Стандарт: ISO/IEC/IEEE 29148 (ранее IEEE 830).",
    "Ориентация: Продукт, архитектура, конечный пользователь.",
    "Стиль: Гибкий инженерный документ для команд разработки (Agile, Scrum).",
    "Версионирование: Эволюционирует вместе с кодом в репозитории через Change Requests.",
]
add_content_card(slide5, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8), "SRS (Software Requirements Spec)", items5_1)

items5_2 = [
    "Стандарт: ГОСТ 34.602-89 (АСУ) или ГОСТ 19.201-78 (ЕСПД).",
    "Ориентация: Комплексная система, регламент поставки, юридическая фиксация.",
    "Стиль: Строгий канцелярит с разделами по приёмке, стадиям и гарантиям.",
    "Юридический статус: Основа для актов приемки-передачи и судебных экспертиз.",
]
add_content_card(slide5, Inches(6.8), Inches(1.8), Inches(5.6), Inches(4.8), "ТЗ (Техническое задание по ГОСТ)", items5_2)


# ==========================================
# СЛАЙД 6: SRS VS ТЗ: СРАВНИТЕЛЬНАЯ МАТРИЦА
# ==========================================
slide6 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide6, "3. Сравнительная матрица: SRS vs ТЗ ГОСТ 34")

# Таблица 5 строк x 3 колонки
rows, cols = 5, 3
left, top, width, height = Inches(0.8), Inches(1.8), Inches(11.7), Inches(4.8)
table_shape = slide6.shapes.add_table(rows, cols, left, top, width, height)
table = table_shape.table
table.columns[0].width = Inches(2.7)
table.columns[1].width = Inches(4.5)
table.columns[2].width = Inches(4.5)

headers = ["Критерий сравнения", "SRS (ISO/IEC/IEEE 29148)", "ТЗ (ГОСТ 34.602-89)"]
for i, h in enumerate(headers):
    cell = table.cell(0, i)
    cell.fill.solid()
    cell.fill.fore_color.rgb = COLOR_ACCENT
    p = cell.text_frame.paragraphs[0]
    p.text = h
    p.font.bold = True
    p.font.size = Pt(13)
    p.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

data = [
    ["Целевая аудитория", "Разработчики, тестировщики, Product Owner", "Госзаказчики, юристы, приемочная комиссия"],
    ["Регламент правок", "Быстрые итерации по бэклогу (Agile/Sprint)", "Тяжелая процедура доп. соглашений к договору"],
    ["Описание архитектуры", "Спецификация API, схемы БД, ER-диаграммы", "Спецификация КТС, состав технических средств"],
    ["Процедура сдачи", "Автотесты, критерии приемки (Definition of Done)", "ПМИ (Программа и методики испытаний), подписание акта"],
]

for row_idx, row_data in enumerate(data, start=1):
    for col_idx, val in enumerate(row_data):
        cell = table.cell(row_idx, col_idx)
        cell.fill.solid()
        cell.fill.fore_color.rgb = COLOR_CARD if row_idx % 2 == 1 else RGBColor(0xF0, 0xEB, 0xDF)
        p = cell.text_frame.paragraphs[0]
        p.text = val
        p.font.size = Pt(11)
        p.font.color.rgb = COLOR_TEXT_MAIN


# ==========================================
# СЛАЙД 7: ПРИМЕР: FLOW TRANSLATE
# ==========================================
slide7 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide7, "4. Практический кейс: Спецификация «Flow Translate»")

items7_1 = [
    "Назначение сервиса: Интеллектуальный мультиязычный перевод текста с ведением персонального словаря.",
    "Поддерживаемые языки: 4 базовых языка — русский, английский, немецкий, испанский.",
    "Ролевой доступ: Пользователь (управление своими словами) и Администратор (аудит и блокировка аккаунтов).",
    "Архитектурный шаблон: Клиент-серверный SPA (Single Page Application) с REST API.",
]
add_content_card(slide7, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8), "Цели и скоуп проекта", items7_1)

items7_2 = [
    "Backend: Python 3.10+, FastAPI (асинхронная обработка I/O операций).",
    "СУБД: PostgreSQL 16 в изолированном контейнере Docker Compose.",
    "ORM: SQLAlchemy 2.0 (asyncpg) с автоматическими миграциями схемы.",
    "Frontend: React + Tailwind CSS с поддержкой компонентной архитектуры.",
    "Безопасность: Хэширование паролей bcrypt, авторизация по токенам JWT (HS256).",
]
add_content_card(slide7, Inches(6.8), Inches(1.8), Inches(5.6), Inches(4.8), "Платформенные ограничения", items7_2)


# ==========================================
# СЛАЙД 8: FR FLOW TRANSLATE
# ==========================================
slide8 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide8, "4. Функциональные требования Flow Translate")

items8_1 = [
    "FR-1 (Перевод): Асинхронная интеграция с внешним сервисом MyMemory с ограничением языковых пар.",
    "FR-2 (Debounce-интерфейс): Автоматический запуск перевода при паузе ввода в 500 мс.",
    "FR-3 (Фаза 5 ТЗ): Проверка факта наличия переводимого слова в словаре пользователя прямо во время запроса.",
]
add_content_card(slide8, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8), "Модуль перевода текста", items8_1)

items8_2 = [
    "FR-4 (Правило дубликатов): Повторное сохранение слова обновляет метку времени updated_at (UPSERT), не создавая дубликат.",
    "FR-5 (Пагинация): Строго 10 записей на страницу (page_size=10) для исключения перегрузки клиента.",
    "FR-6 (Категоризация): Полный CRUD тегов и карточек с привязкой по внешнему ключу FK и каскадами.",
]
add_content_card(slide8, Inches(6.8), Inches(1.8), Inches(5.6), Inches(4.8), "Модуль словаря и категорий", items8_2)


# ==========================================
# СЛАЙД 9: NFR FLOW TRANSLATE
# ==========================================
slide9 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide9, "4. Нефункциональные требования Flow Translate")

items9_1 = [
    "NFR-1: Безопасное хранение паролей — хэширование bcrypt со срезом до 72 байт (защита от краха библиотеки).",
    "NFR-2: Двухфакторная активация учетной записи — отправка 6-значного токена через SMTP.",
    "NFR-3: Аудит безопасности — логирование попыток входа строго без сохранения паролей в открытом виде.",
]
add_content_card(slide9, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8), "Безопасность и отказоустойчивость", items9_1)

items9_2 = [
    "NFR-4: Обработка ВСЕХ исключений — глобальные перехватчики 422 и 500 ошибок в формате RFC 7807.",
    "NFR-5: Персистентность тем оформления — сохранение выбора темы (светлая/темная) в профиле БД.",
    "NFR-6: Аудио-озвучивание — синтез речи произношения карточек через Web Speech API без задержек.",
]
add_content_card(slide9, Inches(6.8), Inches(1.8), Inches(5.6), Inches(4.8), "Интерфейс и стандарты ответа", items9_2)


# ==========================================
# СЛАЙД 10: СПЕЦИАЛЬНЫЙ ВОПРОС СТУДЕНТА
# ==========================================
slide10 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide10, "5. Исследовательский вопрос студента")

items10_1 = [
    "Проблема: Несоответствие между текстом требований и реальным поведением программного кода.",
    "Решение: Методология Specification-by-Example и приемочное тестирование (TDD).",
    "Принцип: Каждое требование спецификации должно иметь проверяемый цифровой критерий приёмки.",
]
add_content_card(slide10, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8), "Трансформация требований в тесты", items10_1)

items10_2 = [
    "Требование: «Пароль от 8 знаков с цифрой и заглавной буквой» ➔ pytest тест валидатора UserRegister.",
    "Требование: «Разрешены только языки RU, EN, DE, ES» ➔ pytest тест ограничений TranslateRequest.",
    "Требование: «Изоляция пользователей словаря» ➔ Интеграционный тест доступа с чужим JWT-токеном (HTTP 404/403).",
    "Итог: Набор из 3+ автоматических тестов гарантирует соблюдение спецификации на 100%.",
]
add_content_card(slide10, Inches(6.8), Inches(1.8), Inches(5.6), Inches(4.8), "Реализация в Flow Translate", items10_2)


# ==========================================
# СЛАЙД 11: ЗАКЛЮЧЕНИЕ
# ==========================================
slide11 = prs.slides.add_slide(prs.slide_layouts[6])
apply_slide_theme(slide11, "Заключение и выводы")

items11_1 = [
    "Спецификация требований — ключевой фактор управляемости, предсказуемости сроков и бюджета разработки ПО.",
    "Выбор стандарта (SRS vs ТЗ ГОСТ) определяется спецификой проекта: гибкий продуктовый цикл либо строгий контракт.",
    "Полнота описания нефункциональных требований (NFR) определяет стабильность и масштабируемость системы.",
]
add_content_card(slide11, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.8), "Теоретические выводы", items11_1)

items11_2 = [
    "Проект Flow Translate подтвердил: детальная предварительная спецификация исключила ошибки проектирования БД и API.",
    "Все 20 критериев приёмки чек-листа и ТЗ были успешно реализованы и подтверждены автоматическими тестами.",
    "Спасибо за внимание! Готов ответить на ваши вопросы.",
]
add_content_card(slide11, Inches(6.8), Inches(1.8), Inches(5.6), Inches(4.8), "Практический итог проекта", items11_2)


# Сохранение презентации
output_filename = "Спецификация_требований_Flow_Translate.pptx"
prs.save(output_filename)
print(f"\n>>> ПРЕЗЕНТАЦИЯ УСПЕШНО СОЗДАНА: {output_filename} <<<")