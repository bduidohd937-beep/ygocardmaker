import { describe, expect, it } from "vitest";
import { newCard, type Project } from "./model";
import { deleteProjectCards, getDeletionTargets, toggleVisibleSelection } from "./cardDeletion";

const project: Project = {
  version: 1,
  name: "혼합 작업실",
  cards: [
    { ...newCard(100, "이소바르"), name: "기존 카드 1", artwork: "image-a" },
    { ...newCard(101, "이소바르"), name: "기존 카드 2" },
    { ...newCard(200, "코스모코드"), name: "코스모코드 A", artwork: "image-b" },
    { ...newCard(201, "코스모코드"), name: "코스모코드 B" },
    { ...newCard(300, "언더스터디"), name: "언더스터디" },
  ],
};

describe("visible card selection", () => {
  it("only selects visible cards, preserving hidden export selections", () => {
    expect(toggleVisibleSelection([100], [200, 201])).toEqual([100, 200, 201]);
    expect(toggleVisibleSelection([100, 200, 201], [200, 201])).toEqual([100]);
  });
  it("does not change selection for an empty filter", () => {
    expect(toggleVisibleSelection([100], [])).toEqual([100]);
  });
});
describe("scoped deletion", () => {
  it("deletes only visible selected cards, not hidden checked cards", () => {
    expect(getDeletionTargets(project.cards, "selected", [100, 200, 201], [100], "전체 테마")
      .map((c) => c.id)).toEqual([100]);
  });
  it("deletes the chosen theme regardless of unrelated checkbox states", () => {
    expect(getDeletionTargets(project.cards, "theme", [100, 200], [], "코스모코드")
      .map((c) => c.id)).toEqual([200, 201]);
    expect(getDeletionTargets(project.cards, "theme", [], [], "전체 테마")).toEqual([]);
  });
  it("keeps unrelated themes, order, and source artwork unchanged", () => {
    const next = deleteProjectCards(project, [100, 101]);
    expect(next.cards.map((c) => c.id)).toEqual([200, 201, 300]);
    expect(next.cards[0].artwork).toBe("image-b");
    expect(project.cards).toHaveLength(5);
    expect(project.cards[0].artwork).toBe("image-a");
  });
  it("supports deleting all cards without inventing a placeholder card", () => {
    expect(deleteProjectCards(project, project.cards.map((c) => c.id)).cards).toEqual([]);
  });
  it("ignores unknown ids and cannot delete a similarly named card from another theme", () => {
    const next = deleteProjectCards(project, [200, 999]);
    expect(next.cards.map((c) => c.id)).toEqual([100, 101, 201, 300]);
  });
});
