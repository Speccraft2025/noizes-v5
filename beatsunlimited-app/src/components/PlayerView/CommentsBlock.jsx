export default function CommentsBlock() {
  return (
    <div className="comments-block">
      <h4>0 comments</h4>
      <div className="comment-input-row">
        <div className="comment-avatar" />
        <input type="text" placeholder="Add a comment..." />
      </div>
    </div>
  );
}
