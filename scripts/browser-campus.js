async (page) => {
  // Invoked by Playwright CLI run-code after observing the live UI snapshots.
  // Never persist storageState/cookies/passwords. Only assertion metadata and PNGs.
  const captureDir = "output/playwright/campusdesk-final-2026-10-09";
  const results = [], screenshots = [], runtimeErrors = [], networkFailures = [], unexpectedConsole = [];
  const variants = ["sql-unsafe", "sql-safe", "mongo-unsafe", "mongo-safe"];
  let variant = "", dialogs = 0, expectedNegativeHttp = 0;
  page.on("pageerror", error => runtimeErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && !/status of (400|401|403|429)/.test(message.text())) unexpectedConsole.push(message.text());
  });
  page.on("response", response => { if ([400,401,403].includes(response.status())) expectedNegativeHttp++; });
  page.on("requestfailed", request => networkFailures.push({ url: request.url().split("?")[0], failure: request.failure()?.errorText }));
  page.on("dialog", async dialog => { dialogs++; await dialog.dismiss(); });
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const pass = name => results.push({variant,name,pass:true});
  const capture = async name => {
    const filename=variant+"-"+name+".png";
    await page.screenshot({path:captureDir+"/"+filename,fullPage:true,scale:"css",animations:"disabled"});
    screenshots.push({variant,name,file:filename});
  };
  const nav = async name => {
    if (page.viewportSize().width <= 760 && !(await page.locator(".sidebar").getAttribute("class")).includes("visible")) {
      await page.getByRole("button",{name:"Mở menu",exact:true}).click();
      await page.locator(".sidebar.visible").waitFor();
    }
    await page.getByRole("button",{name,exact:true}).click();
  };
  const logout = async () => {
    if (page.viewportSize().width <= 760 && !(await page.locator(".sidebar").getAttribute("class")).includes("visible")) {
      await page.getByRole("button",{name:"Mở menu",exact:true}).click();
      await page.locator(".sidebar.visible").waitFor();
    }
    await page.getByRole("button",{name:"Đăng xuất",exact:true}).click();
    await page.getByRole("heading",{name:"Đăng nhập CampusDesk",exact:true}).waitFor();
  };
  const login = async (username,password) => {
    await page.getByRole("textbox",{name:"Tên đăng nhập",exact:true}).fill(username);
    await page.getByRole("textbox",{name:"Mật khẩu",exact:true}).fill(password);
    await page.getByRole("button",{name:"Đăng nhập",exact:true}).last().click();
    await page.getByRole("heading",{name:/Chào /}).waitFor();
    await page.getByRole("heading",{name:"Tiến độ hỗ trợ",exact:true}).waitFor();
  };
  const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Body overflows viewport");
  for (let index=0;index<variants.length;index++) {
    variant=variants[index];
    const base="http://127.0.0.1:"+(3001+index),safe=variant.endsWith("-safe");
    try {
      await page.setViewportSize({width:1440,height:1000});
      await page.goto(base);
      await page.getByRole("button",{name:/Đăng nhập|Đăng xuất/}).first().waitFor();
      if(await page.getByRole("button",{name:"Đăng xuất",exact:true}).count())await logout();
      await page.getByRole("heading",{name:"Đăng nhập CampusDesk",exact:true}).waitFor();
      await capture("login-desktop");await noOverflow();pass("desktop login layout");
      await page.getByRole("textbox",{name:"Mật khẩu",exact:true}).fill("not-the-password");
      await page.getByRole("button",{name:"Đăng nhập",exact:true}).last().click();
      await page.getByRole("alert").waitFor();assert((await page.getByRole("alert").innerText()).includes("không đúng"),"Wrong password not rejected");
      await capture("wrong-password");pass("wrong password rendered as expected error");
      const config=await (await page.request.get(base+"/api/config")).json();
      for(const payload of config.payloads) {
        await page.getByRole("button",{name:"Demo injection",exact:true}).click();
        await page.getByRole("combobox",{name:"Payload demo",exact:true}).click();
        await page.getByRole("option",{name:payload.label,exact:true}).click();
        await capture("payload-"+payload.id+"-request");
        await page.getByRole("button",{name:"Gửi payload & đăng nhập",exact:true}).click();
        if(safe) {
          await page.getByRole("alert").waitFor();
          assert(await page.getByRole("heading",{name:"Đăng nhập CampusDesk",exact:true}).isVisible(),"Safe payload authenticated");
          assert((await page.request.get(base+"/api/auth/me")).status()===401,"Safe payload got server session");
          if (variant === "mongo-safe") assert((await page.locator(".diagnostics").innerText()).includes("Chưa chạy"), "Missing pre-query rejection diagnostic");
          await capture("payload-"+payload.id+"-blocked");
        } else {
          await page.getByRole("button",{name:"Người dùng",exact:true}).waitFor();
          await page.getByRole("heading",{name:"Tiến độ hỗ trợ",exact:true}).waitFor();
          const me=await (await page.request.get(base+"/api/auth/me")).json();
          assert(me.user.username==="admin"&&me.user.role==="admin","Payload did not create real admin session");
          await nav("Nhật ký & demo");
          await page.getByRole("heading",{name:"Phiên đăng nhập hiện tại",exact:true}).waitFor();
          await capture("payload-"+payload.id+"-admin-session");
          await logout();
        }
        pass("preset "+payload.id+(safe?" blocked":" real admin session"));
      }
      if (variant.startsWith("mongo")) {
        await page.getByRole("button",{name:"Demo injection",exact:true}).click();
        await page.getByRole("checkbox",{name:"Nhập payload tùy chỉnh",exact:true}).check();
        assert(await page.locator(".payload-preview").count()===0,"Preset preview misrepresents custom input");
        await page.getByRole("textbox",{name:"Payload tùy chỉnh",exact:true}).fill(JSON.stringify(JSON.stringify({$gt:""})));
        const attempted = page.waitForResponse(r=>r.url()===base+"/api/auth/login" && r.request().method()==="POST");
        await page.getByRole("button",{name:"Gửi payload & đăng nhập",exact:true}).click();
        assert((await attempted).status()===401,"Stringified object was not a literal failed password");
        await page.locator(".diagnostics code").filter({hasText:/^string$/}).waitFor();
        assert((await page.request.get(base+"/api/auth/me")).status()===401,"Stringified object authenticated");
        await capture("stringified-operator-denied");
        await page.getByRole("checkbox",{name:"Nhập payload tùy chỉnh",exact:true}).uncheck();
        pass("custom JSON string remains literal; preview and diagnostic match actual request");
      }
      await page.getByRole("button",{name:"Đăng nhập",exact:true}).first().click();
      await login("admin","Admin@123");
      await capture("admin-dashboard");pass("normal admin login and real dashboard");
      await page.reload();await page.getByRole("button",{name:"Người dùng",exact:true}).waitFor();pass("refresh restores admin session");
      await nav("Người dùng");await page.getByRole("heading",{name:"Người dùng",exact:true}).waitFor();
      await page.getByRole("row").filter({hasText:"student2"}).waitFor();await capture("admin-users");
      await page.getByRole("button",{name:"Tạo tài khoản",exact:true}).click();
      const accountDialog=page.getByRole("dialog");
      const account="browser_"+Date.now();
      await accountDialog.getByRole("textbox",{name:"Họ tên",exact:true}).fill("Browser QA User");
      await accountDialog.getByRole("textbox",{name:"Username",exact:true}).fill(account);
      await accountDialog.getByRole("textbox",{name:"Email",exact:true}).fill("browser@campus.example");
      await accountDialog.getByRole("textbox",{name:"Mật khẩu mới",exact:true}).fill("Browser@456");
      await capture("admin-create-user-dialog");
      await accountDialog.getByRole("button",{name:"Tạo tài khoản",exact:true}).click();
      await page.getByRole("dialog").waitFor({state:"hidden"});
      await page.getByRole("row").filter({hasText:account}).waitFor();pass("admin creates account through UI");
      const student2=page.getByRole("row").filter({hasText:"student2"});
      await student2.getByRole("button",{name:"Khóa",exact:true}).click();
      await student2.getByText("Đã khóa",{exact:true}).waitFor();await capture("admin-locked-account");
      await student2.getByRole("button",{name:"Mở khóa",exact:true}).click();
      await student2.getByText("Hoạt động",{exact:true}).waitFor();pass("admin locks and unlocks account");
      await nav("Yêu cầu hỗ trợ");await page.getByRole("textbox",{name:"Tìm yêu cầu",exact:true}).waitFor();
      await page.getByRole("button",{name:"Trang sau",exact:true}).click();
      await page.getByText(/Trang 2\//).waitFor();await capture("tickets-page-2");pass("ticket pagination");
      await page.getByRole("button",{name:"Trang trước",exact:true}).click();
      await page.getByRole("textbox",{name:"Tìm yêu cầu",exact:true}).pressSequentially("Wifi",{delay:100});
      await page.getByRole("button",{name:/CD-1003 Wifi/}).waitFor();
      assert(await page.getByRole("textbox",{name:"Tìm yêu cầu",exact:true}).inputValue()==="Wifi","Search lost focus during typing");
      await capture("ticket-search");pass("search keeps focus during natural typing");
      await page.getByRole("textbox",{name:"Tìm yêu cầu",exact:true}).fill("");
      await page.getByRole("button",{name:/CD-1001 Không truy cập/}).waitFor();
      await page.getByRole("button",{name:/CD-1001 Không truy cập/}).click();
      await page.getByRole("dialog").getByRole("combobox",{name:"Trạng thái",exact:true}).selectOption("resolved");
      await capture("admin-ticket-edit");
      await page.getByRole("button",{name:"Lưu cập nhật",exact:true}).click();
      await page.getByRole("dialog").waitFor({state:"hidden"});pass("admin updates ticket through modal");
      await nav("Hồ sơ cá nhân");await page.getByRole("heading",{name:"Hồ sơ cá nhân",exact:true}).waitFor();
      await capture("admin-profile");pass("admin profile screen");
      await page.setViewportSize({width:390,height:844});
      await nav("Tổng quan");await page.getByRole("heading",{name:"Tiến độ hỗ trợ",exact:true}).waitFor();await noOverflow();
      await capture("admin-mobile-dashboard");pass("390px admin dashboard fits viewport");
      await page.getByRole("button",{name:"Mở menu",exact:true}).click();await capture("admin-mobile-menu");
      // The overlay's center is behind the 248px drawer; click the exposed right edge.
      await page.getByRole("button",{name:"Đóng menu",exact:true}).click({position:{x:page.viewportSize().width-12,y:100}});pass("mobile sidebar opens and closes");
      await page.setViewportSize({width:1440,height:1000});
      await logout();await login("student","Student@123");
      assert(await page.getByRole("button",{name:"Người dùng",exact:true}).count()===0,"Student has admin navigation");
      assert((await page.request.get(base+"/api/admin/users")).status()===403,"Student API admin restriction failed");
      await capture("user-dashboard");pass("user dashboard and backend admin restriction");
      await nav("Hồ sơ cá nhân");await page.getByRole("heading",{name:"Hồ sơ cá nhân",exact:true}).waitFor();
      await page.getByRole("textbox",{name:"Họ tên",exact:true}).fill("Nguyễn Minh Anh");
      await page.getByRole("button",{name:"Lưu thay đổi",exact:true}).click();
      await page.getByRole("status").waitFor();await capture("user-profile-saved");pass("user profile update through UI");
      await nav("Yêu cầu hỗ trợ");await page.getByRole("button",{name:"Tạo yêu cầu",exact:true}).click();
      const title="Browser QA "+variant+" "+Date.now();
      await page.getByRole("textbox",{name:"Tiêu đề",exact:true}).fill(title);
      await page.getByRole("textbox",{name:"Nội dung",exact:true}).fill("Nội dung giả lập <img src=x onerror=alert(1)> phải hiển thị dạng text.");
      await capture("user-create-ticket-dialog");
      await page.getByRole("button",{name:"Gửi yêu cầu",exact:true}).click();
      await page.getByRole("dialog").waitFor({state:"hidden"});
      await page.getByRole("button",{name:new RegExp(title)}).waitFor();await capture("user-ticket-created");
      await page.getByRole("button",{name:new RegExp(title)}).click();
      const ticketDialog=page.getByRole("dialog");await ticketDialog.waitFor();
      assert((await ticketDialog.innerText()).includes("<img src=x"),"Stored markup not rendered as literal text");
      assert(await ticketDialog.locator("img").count()===0,"Stored markup became a DOM image");
      assert(await ticketDialog.getByRole("button",{name:"Lưu cập nhật",exact:true}).count()===0,"User has admin edit control");
      await capture("user-ticket-detail-literal-xss");pass("user creates ticket; markup escaped and no admin edit");
      await page.getByRole("button",{name:"Đóng",exact:true}).click();
      await page.setViewportSize({width:390,height:844});await nav("Tổng quan");
      await page.getByRole("heading",{name:"Tiến độ hỗ trợ",exact:true}).waitFor();await noOverflow();await capture("user-mobile-dashboard");pass("390px user dashboard fits viewport");
      await nav("Yêu cầu hỗ trợ");await page.getByRole("textbox",{name:"Tìm yêu cầu",exact:true}).waitFor();await noOverflow();await capture("user-mobile-tickets");pass("390px ticket table scroll is contained");
      await page.getByRole("button",{name:"Tạo yêu cầu",exact:true}).click();await page.getByRole("dialog").waitFor();await noOverflow();await capture("user-mobile-create-dialog");
      await page.getByRole("button",{name:"Hủy",exact:true}).click();pass("mobile create dialog and cancel");
      await logout();await noOverflow();await capture("login-mobile");pass("logout returns login and mobile login fits");
      assert((await page.request.get(base+"/api/auth/me")).status()===401,"Logout session remained authenticated");pass("browser logout destroys real session");
      await page.setViewportSize({width:768,height:1024});await noOverflow();await capture("login-tablet");pass("768px tablet login fits");
      await page.setViewportSize({width:1440,height:1000});await page.goto(base+"/docs/");
      await page.getByRole("heading",{name:"Tài liệu & cổng demo",exact:true}).waitFor();await capture("documentation-hub");
      for(const file of ["RUN_AND_TEST","ARCHITECTURE","DATABASE","API","SECURITY","TESTING","DEVELOPMENT","DEMO_GUIDE","PROJECT_OVERVIEW"]) {
        const response=await page.request.get(base+"/docs/"+file+".html");
        assert(response.status()===200&&(await response.text()).includes("<article>"),"Documentation missing: "+file);
      }
      pass("documentation hub and nine current HTML documents");
    } catch(error) {
      results.push({variant,name:"browser flow",pass:false,error:error.message});
      await capture("FAIL-current-state").catch(()=>{});
    }
  }
  results.push({variant:"all",name:"no JavaScript runtime errors",pass:runtimeErrors.length===0,error:runtimeErrors.length?runtimeErrors.join("; "):undefined});
  results.push({variant:"all",name:"no unexpected console errors",pass:unexpectedConsole.length===0,error:unexpectedConsole.length?unexpectedConsole.join("; "):undefined});
  results.push({variant:"all",name:"no failed network requests",pass:networkFailures.length===0,error:networkFailures.length?JSON.stringify(networkFailures):undefined});
  results.push({variant:"all",name:"no injected browser dialogs",pass:dialogs===0});
  return {generatedAt:new Date().toISOString(),browser:"Chromium via Playwright CLI",viewports:["1440x1000","390x844","768x1024"],total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,expectedNegativeHttp,runtimeErrors,unexpectedConsole,networkFailures,results,screenshots};
}
