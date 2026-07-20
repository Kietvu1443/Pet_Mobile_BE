-- ====================================================
-- Migration: Add Missing Foreign Keys & Unique Constraints
-- ====================================================

USE pet_helper;

-- ----------------------------------------------------
-- 1. CLEANUP ORPHANS & DUPLICATES
-- ----------------------------------------------------

-- News: Set author_id to NULL if user doesn't exist
UPDATE news SET author_id = NULL WHERE author_id NOT IN (SELECT id FROM users);

-- News Comments: Remove orphans
DELETE FROM news_comments WHERE news_id NOT IN (SELECT id FROM news);
DELETE FROM news_comments WHERE user_id NOT IN (SELECT id FROM users);
DELETE FROM news_comments WHERE parent_id IS NOT NULL AND parent_id NOT IN (SELECT * FROM (SELECT id FROM news_comments) AS tmp);

-- News Likes: Remove orphans and duplicates
DELETE FROM news_likes WHERE news_id NOT IN (SELECT id FROM news);
DELETE FROM news_likes WHERE user_id NOT IN (SELECT id FROM users);
DELETE n1 FROM news_likes n1 JOIN news_likes n2 
WHERE n1.id > n2.id AND n1.news_id = n2.news_id AND n1.user_id = n2.user_id;

-- News Follows: Remove orphans
DELETE FROM news_follows WHERE news_id NOT IN (SELECT id FROM news);
DELETE FROM news_follows WHERE user_id NOT IN (SELECT id FROM users);

-- News Comment Likes: Remove orphans
DELETE FROM news_comment_likes WHERE comment_id NOT IN (SELECT id FROM news_comments);
DELETE FROM news_comment_likes WHERE user_id NOT IN (SELECT id FROM users);

-- Product Reviews: Remove orphans
DELETE FROM product_reviews WHERE product_id NOT IN (SELECT id FROM products);
DELETE FROM product_reviews WHERE user_id NOT IN (SELECT id FROM users);

-- Product Review Likes: Remove orphans
DELETE FROM product_review_likes WHERE review_id NOT IN (SELECT id FROM product_reviews);
DELETE FROM product_review_likes WHERE user_id NOT IN (SELECT id FROM users);

-- Product Likes: Remove orphans and duplicates
DELETE FROM product_likes WHERE product_id NOT IN (SELECT id FROM products);
DELETE FROM product_likes WHERE user_id NOT IN (SELECT id FROM users);
DELETE p1 FROM product_likes p1 JOIN product_likes p2 
WHERE p1.id > p2.id AND p1.product_id = p2.product_id AND p1.user_id = p2.user_id;

-- Pet Likes: Remove orphans and duplicates
DELETE FROM pet_likes WHERE pet_id NOT IN (SELECT id FROM pets);
DELETE FROM pet_likes WHERE user_id NOT IN (SELECT id FROM users);
DELETE p1 FROM pet_likes p1 JOIN pet_likes p2 
WHERE p1.id > p2.id AND p1.pet_id = p2.pet_id AND p1.user_id = p2.user_id;

-- Pet Images: Remove orphans (pet_id can be NULL based on reports migration)
DELETE FROM pet_images WHERE pet_id IS NOT NULL AND pet_id NOT IN (SELECT id FROM pets);

-- ----------------------------------------------------
-- 2. ADD FOREIGN KEYS & CONSTRAINTS
-- ----------------------------------------------------

-- News
ALTER TABLE news
    MODIFY COLUMN author_id INT NULL,
    ADD CONSTRAINT fk_news_author 
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

-- News Comments
ALTER TABLE news_comments
    ADD CONSTRAINT fk_news_comments_news 
    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_news_comments_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_news_comments_parent 
    FOREIGN KEY (parent_id) REFERENCES news_comments(id) ON DELETE CASCADE;

-- News Likes
ALTER TABLE news_likes
    ADD CONSTRAINT fk_news_likes_news 
    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_news_likes_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT uk_news_likes UNIQUE (news_id, user_id);

-- News Follows
ALTER TABLE news_follows
    ADD CONSTRAINT fk_news_follows_news 
    FOREIGN KEY (news_id) REFERENCES news(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_news_follows_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- News Comment Likes
ALTER TABLE news_comment_likes
    ADD CONSTRAINT fk_ncl_comment 
    FOREIGN KEY (comment_id) REFERENCES news_comments(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_ncl_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Product Reviews
ALTER TABLE product_reviews
    ADD CONSTRAINT fk_pr_product 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_pr_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Product Review Likes
ALTER TABLE product_review_likes
    ADD CONSTRAINT fk_prl_review 
    FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_prl_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Product Likes
ALTER TABLE product_likes
    ADD CONSTRAINT fk_pl_product 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_pl_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    ADD CONSTRAINT uk_product_likes UNIQUE (product_id, user_id);

-- Pet Likes
ALTER TABLE pet_likes
    -- NOTE: pet_likes already has a UNIQUE constraint unique_interaction(user_id, pet_id) 
    -- from schema.sql. This adds it in case it's missing or we want an explicit one.
    -- (You may drop this if unique_interaction is already working).
    ADD CONSTRAINT uk_pet_likes UNIQUE (pet_id, user_id);

    -- Note: pet_likes and pet_images already have FK constraints from schema.sql.
    -- If they were manually dropped, uncomment the following to add them back:
    -- ADD CONSTRAINT fk_pet_likes_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE,
    -- ADD CONSTRAINT fk_pet_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Pet Images
-- ALTER TABLE pet_images
    -- ADD CONSTRAINT fk_pi_pet FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE;
