import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { menuItems } from "../src/data/menu";
import { dishSearchText, localizedDish, menuTranslations } from "../src/data/menu-translations";
import { isLanguage, siteTranslations, translate } from "../src/lib/site-language";

test("every existing dish has Russian and Uzbek names and descriptions", () => {
  for (const item of menuItems) {
    assert.equal(menuTranslations[item.id]?.length, 4, item.id);
    for (const language of ["ru", "uz"] as const) {
      const translated = localizedDish(item, language);
      assert.ok(translated.name.trim(), `${item.id}/${language} name`);
      assert.ok(translated.description.trim(), `${item.id}/${language} description`);
    }
  }
});

test("menu search accepts Russian and Uzbek and preserves owner edits", () => {
  const dish = menuItems.find(item => item.id === "plov")!;
  assert.ok(dishSearchText(dish).includes("плов"));
  assert.ok(dishSearchText(dish).includes("osh"));
  assert.equal(localizedDish({ ...dish, name: "New seasonal dish" }, "ru").name, "New seasonal dish");
  assert.equal(localizedDish({ ...dish, description: "New recipe" }, "uz").description, "New recipe");
  assert.equal(localizedDish({ ...dish, id: "new-dish" }, "uz").name, dish.name);
});

test("known languages are accepted and English/Korean copy stays intact", () => {
  for (const code of ["ko", "en", "ru", "uz"]) assert.equal(isLanguage(code), true);
  for (const value of [null, "", "xx", {}, undefined]) assert.equal(isLanguage(value), false);
  assert.equal(translate("ko", "Language", "언어"), "언어");
  assert.equal(translate("en", "Language", "언어"), "Language");
  assert.equal(translate("ru", "Language"), "Язык");
  assert.equal(translate("uz", "Language"), "Til");
});

test("customer page translation calls have both new language entries", () => {
  const missing = new Set<string>();
  for (const name of ["RestaurantSite", "SilkRoadSections", "OrderPage", "EntryGate", "GuestProfile"]) {
    const path = `src/components/${name}.tsx`;
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "t" && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        if (!siteTranslations[key]?.every(text => text.trim())) missing.add(`${name}: ${key}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual([...missing], []);
});
