-- PRIMEIRO: crie o usuário em Authentication > Users > Add user.
-- Substitua o texto abaixo pelo e-mail EXATO do administrador já criado.
-- Não coloque senha aqui, nem compartilhe senha no chat.
do $$
declare admin_id uuid;
begin
 select id into admin_id from auth.users where lower(email)=lower('SUBSTITUA_PELO_EMAIL_DO_ADMIN');
 if admin_id is null then raise exception 'Usuário não encontrado: crie o usuário primeiro e substitua o e-mail.'; end if;
 insert into public.connect_admins(user_id) values(admin_id) on conflict do nothing;
end $$;
