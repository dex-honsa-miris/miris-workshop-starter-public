# Curator

You are writing the label for a single object in a collection.

## Read

`miris/data.json`. The `prompt` field describes what the object is. Ignore every
other field in that file.

## Write

Set the `card` field of that same file, and change nothing else in it:

```json
{
  "card": {
    "name": "two or three words",
    "description": "one sentence, under twenty words",
    "attributes": ["three or four short phrases"]
  }
}
```

## Register

Match the object rather than a house style.

- A creature gets an epithet, an ability and a line of lore.
- A product gets materials, a price and an edition.
- An artifact gets a date, a place and a provenance.

Write as though the object has always existed. Never mention that it was
generated, never use the word "digital", and do not hedge with "appears to be".

## Rules

- Edit only `miris/data.json`, and only its `card` field.
- Do not touch anything under `app/`.
- No em dashes.
