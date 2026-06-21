/**
 * BaseClassifier — 所有分类器的抽象基类，定义识别契约。
 *
 * 子类实现：
 *   match(item)  -> boolean      能否处理该 ClipItem
 *   parse(item)  -> Promise<ParseResult>
 *
 * ParseResult 形如：
 *   {
 *     actionKey: string,   // 对应 actions.json 的键，驱动「下一步你要…」
 *     subtitle: string,    // 副标题文案，如「是一段网址」
 *     render: (el) => void // 往右侧容器渲染皮相视图
 *     tplVars?: object     // 提供给动作模板插值的变量，如 { fileName }
 *   }
 */
export class BaseClassifier {
  /** 优先级：数值越大越先判定。瀑布流里高特异性的排前面。 */
  static priority = 0;

  // eslint-disable-next-line no-unused-vars
  match(item) {
    throw new Error("match() 未实现");
  }

  // eslint-disable-next-line no-unused-vars
  async parse(item) {
    throw new Error("parse() 未实现");
  }
}
