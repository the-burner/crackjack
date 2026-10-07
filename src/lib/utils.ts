import { createCn } from 'cn/config';

/** Joins class names, later Tailwind classes winning; knows the app's type scale (index.css). */
export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: ['tiny', 'caption', 'body', 'title', 'heading'] }] } },
});
