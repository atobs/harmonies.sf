describe("A blank test for harmonies", function() {
  it("should work", function(done) {
    SF.controller("harmonies", function(ctrl) {
      assert.notEqual(ctrl, null);

      done();
    });
  });
});
