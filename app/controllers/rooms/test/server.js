describe("A blank test for rooms", function() {
  it("should work", function(done) {
    SF.controller("rooms", function(ctrl) {
      assert.notEqual(ctrl, null);

      done();
    });
  });
});
