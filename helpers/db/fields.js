class Create {
  constructor(schema, Type, addToSchema, addArrayToSchema) {
    this.indexes = {};
    this.weights = {};
    this.schema = schema;
    this.Type = Type;
    this.addToSchema = addToSchema;
    this.addArrayToSchema = addArrayToSchema;
  }

  fromString(item) {
    this.schema.add(this.addToSchema(item));
    this.indexes[`fuzzy.${item}`] = 'text';
  }

  fromObject(item) {
    this.schema.add(this.addToSchema(item.name));
    this.indexes[`fuzzy.${item.name}`] = 'text';
    if (item.weight) {
      this.weights[`fuzzy.${item.name}`] = item.weight;
    }
  }

  fromObjectKeys(item) {
    item.keys.forEach((key) => {
      this.indexes[`fuzzy.${item.name}.${key}`] = 'text';
    });
    this.schema.add(this.addArrayToSchema(this.Type)(item.name));
  }
}

class Remove {
  constructor(schema) {
    this.schema = schema;
  }

  fromString(item) {
    delete this.schema.fuzzy[item.name];
  }

  fromObject(item) {
    delete this.schema.fuzzy[item.name];
  }

  fromObjectKeys(item) {
    delete this.schema.fuzzy[item.name];
  }
}

class Generate {
  constructor(attributes, makeNGrams) {
    this.attributes = attributes;
    this.makeNGrams = makeNGrams;
  }

  fromString(item) {
    let value = this.attributes[item];
    if (value) {
      if (Array.isArray(value)) {
        value = value.join(' ');
      }

      this.attributes.fuzzy[item] = this.makeNGrams(value);
    }
  }

  fromObject(item) {
    let value = this.attributes[item.name];
    if (value) {
      const escapeSpecialCharacters = item.escapeSpecialCharacters !== false;

      if (Array.isArray(value)) {
        value = value.join(' ');
      }

      this.attributes.fuzzy[item.name] = this.makeNGrams(
        value,
        escapeSpecialCharacters,
        item.minSize,
        item.prefixOnly,
      );
    }
  }

  fromObjectKeys(item) {
    if (this.attributes[item.name]) {
      const escapeSpecialCharacters = item.escapeSpecialCharacters !== false;
      const attrs = [];
      let obj = {};

      let data = this.attributes[item.name];
      if (!Array.isArray(data)) {
        data = [data];
      }

      data.forEach((d) => {
        item.keys.forEach((key) => {
          obj = {
            ...obj,
            fuzzy: {[key]: this.makeNGrams(
              d[key],
              escapeSpecialCharacters,
              item.minSize,
              item.prefixOnly,
            )},
          };
        });
        attrs.push(obj);
      });
      this.attributes.fuzzy[item.name] = attrs;
    }
  }
}

const createByFieldType = (isString, isObject) => (obj) => (item) => {
  if (isString(item)) {
    obj.fromString(item);
    return;
  }

  if (!isObject(item)) {
    throw new TypeError('Fields items must be String or Object.');
  }

  if (item.keys) {
    obj.fromObjectKeys(item);
    return;
  }

  obj.fromObject(item);
};

/**
 * Add the fields to the collection
 * @param {object} schema - The mongoose schema
 * @param {array} fields - The fields to add to the collection
 */
const createFields = (addToSchema, addArrayToSchema, createField, MixedType) => (
  schema,
  fields,
) => {
  const create = new Create(schema, MixedType, addToSchema, addArrayToSchema);
  fields.forEach(createField(create));
  return { indexes: create.indexes, weights: create.weights };
};

/**
 * Removes fuzzy keys from the document
 * @param {array} fields - the fields to remove
 */
const removeFuzzyElements = (createField) => (fields) => (_doc, ret) => {
  const remove = new Remove(ret);
  delete remove.schema.fuzzy;
  return remove.schema;
};

/**
 * Creates nGrams for the documents
 * @param {object} attributes - Schema attributes
 * @param {array} fields
 */
const createNGrams = (makeNGrams, createField) => (attributes, fields) => {
  if (!attributes) {
    return;
  }
  const generate = new Generate(attributes, makeNGrams);
  fields.forEach(createField(generate));
};

module.exports = {
  createByFieldType,
  createFields,
  removeFuzzyElements,
  createNGrams,
};
