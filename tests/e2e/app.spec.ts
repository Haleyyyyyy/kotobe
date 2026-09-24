import { test, expect } from "@playwright/test";
test("desktop: import, edit, study, export and navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/");
  await page.getByRole("button", { name: "体验演示" }).click();
  await expect(
    page.getByRole("heading", { name: "每天学点日语." }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../work/desktop-dashboard.png",
    fullPage: true,
  });
  await page.locator(".sidebar").getByRole("link", { name: "词汇" }).click();
  await page.getByRole("button", { name: "导入", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "words.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "word,kana,meaning_zh,meaning_en,jlpt_level\n継続,けいぞく,继续,continuation,N1\n",
    ),
  });
  await expect(page.getByText("找到 1 个词汇")).toBeVisible();
  await page.getByRole("button", { name: "确认导入" }).click();
  await page.getByRole("textbox", { name: "搜索词汇" }).fill("継続");
  await page.getByRole("button", { name: /継続/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page
    .getByLabel("个人笔记")
    .fill("在浏览器测试中导入并编辑。");
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(
    page.getByText("在浏览器测试中导入并编辑。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭窗口" }).click();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "学习", exact: true })
    .click();
  await page
    .getByRole("button", { name: "显示答案", exact: false })
    .last()
    .click();
  await expect(page.getByText("你记得怎么样？")).toBeVisible();
  await page.screenshot({
    path: "../../work/desktop-study.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /记得/ }).click();
  await expect(page.locator(".study-heading")).toContainText("2 /");
  await page.locator(".sidebar").getByRole("link", { name: "设置" }).click();
  await page.getByLabel("每日新词").fill("15");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByRole("status")).toContainText("设置已保存。");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出我的数据" }).click();
  expect((await downloaded).suggestedFilename()).toContain("kotoba-all");
  await page.locator(".sidebar").getByRole("link", { name: "统计" }).click();
  await expect(
    page.getByRole("heading", { name: "看看自己的进步。" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "学习日历" }).click();
  await expect(
    page.getByRole("heading", { name: "你的学习日历。" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile: no document overflow, flashcards and bottom navigation work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "体验演示" }).click();
  await expect(
    page.getByRole("heading", { name: "每天学点日语." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../work/mobile-dashboard.png",
    fullPage: true,
  });
  await page
    .locator(".mobile-nav")
    .getByRole("link", { name: "学习", exact: true })
    .click();
  await page
    .getByRole("button", { name: "显示答案", exact: false })
    .last()
    .click();
  await page.screenshot({
    path: "../../work/mobile-study.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /记得/ }).click();
  await expect(page.locator(".study-heading")).toContainText("2 /");
  await page.locator(".mobile-nav").getByRole("link", { name: "词汇" }).click();
  await page.getByRole("button", { name: "添加词汇" }).click();
  await page.getByLabel("日语词汇").fill("未来");
  await page.getByLabel("英文释义").fill("future");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "添加词汇", exact: true })
    .click();
  await page.getByRole("textbox", { name: "搜索词汇" }).fill("未来");
  await expect(
    page.getByRole("button", { name: "未来", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
