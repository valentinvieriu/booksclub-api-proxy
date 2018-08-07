-- find emtry strings
SELECT * FROM book WHERE coalesce( trim(long_description),'')='' IS NOT FALSE LIMIT 5 
-- clean up emty strings
UPDATE book SET long_description = NULL WHERE coalesce( trim(long_description),'')='' IS NOT FALSE
-- remove the data section - if needed
UPDATE book SET data=NULL

-- Count books with description
SELECT 
    count(CASE WHEN long_description is NOT NULL THEN 1 END) as has_long_description,
    count(CASE WHEN meta_description is NULL THEN 1 END) as no_long_description,
    count(id) as total
FROM
   book

--- Count items without long description
SELECT 
count(CASE WHEN Length(long_description) < 1 THEN 1 END) as no_long_description,
count(id) as total
FROM 
	book

--- Update only couple of items
UPDATE book SET long_description = NULL WHERE id IN (SELECT id FROM book WHERE coalesce( trim(long_description),'')='' IS NOT FALSE LIMIT 5 )