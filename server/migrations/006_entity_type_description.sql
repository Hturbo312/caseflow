-- 006: 概念（实体类型）增加定义字段，供研究框架视图就地编辑与展示
ALTER TABLE entity_types ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
